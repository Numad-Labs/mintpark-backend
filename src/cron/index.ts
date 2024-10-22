import {
  ASSETTYPE,
  DEFAULT_FEE_RATE,
  SERVICE_FEE,
  SERVICE_FEE_ADDRESS,
} from "../../blockchain/utxo/constants";
import {
  getRawTransaction,
  sendRawTransactionWithNode,
} from "../../blockchain/utxo/fractal/libs";
import { mint } from "../../blockchain/utxo/fractal/mint";
import {
  OrderItemDetails,
  orderItemRepository,
} from "../repositories/orderItemRepository";
import { orderRepository } from "../repositories/orderRepostory";
import { userRepository } from "../repositories/userRepository";
import { orderServices } from "../services/orderServices";
import { getObjectFromS3 } from "../utils/aws";
import { PromisePool } from "@supercharge/promise-pool";
import { sleep } from "../utils/timer";
import { collectionRepository } from "../repositories/collectionRepository";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { LaunchItem } from "../types/db/types";
import { redis } from "..";

const cron = require("node-cron");

export async function checkAndUpdateCollectibleStatus() {
  cron.schedule("*/5 * * * *", async () => {
    return;
  });
}

export function checkPaymentAndUpdateOrderStatus() {
  cron.schedule("*/5 * * * *", async () => {
    try {
      /*
        FETCH ONLY FRACTAL ORDERS ✅
      */
      const orders = await orderRepository.getAll("FRACTAL");
      let totalUpdated = 0;

      for (const order of orders) {
        try {
          const isPaid = await orderServices.checkOrderisPaid(order.id);
          if (isPaid && order.orderStatus === "PENDING") {
            await orderRepository.update(order.id, { orderStatus: "IN_QUEUE" });
            totalUpdated++;
          } else if (!isPaid && order.orderStatus === "PENDING") {
            const THREE_HOURS_IN_MS = 3 * 60 * 60 * 1000;
            if (
              new Date(order.createdAt) <
              new Date(Date.now() - THREE_HOURS_IN_MS)
            ) {
              await orderRepository.update(order.id, {
                orderStatus: "EXPIRED",
              });
              totalUpdated++;
            }
          }
        } catch (error) {
          console.error(`Error processing order ${order.id}:`, error);
        }
      }
    } catch (error) {
      console.error("Error in checkPaymentAndUpdateOrderStatus:", error);
    }
  });
}

const MAX_CONCURRENT_MINTS = 5;
const MAX_RETRIES = 60;
const RETRY_INTERVAL = 10000;
const LOCK_KEY = "minting_queue_lock";
const LOCK_EXPIRY = 59;

export function mintingQueue() {
  cron.schedule("*/1 * * * *", async () => {
    console.log("Attempting to start minting queue process...");

    // Try to acquire a lock
    const acquired = await redis.set(
      LOCK_KEY,
      "locked",
      "EX",
      LOCK_EXPIRY,
      "NX"
    );

    if (!acquired) {
      console.log(
        "Another minting queue process is already running. Skipping this run."
      );
      return;
    }

    try {
      console.log("Lock acquired. Starting minting queue process...");
      const orders = await orderRepository.getInQueueOrders("FRACTAL");
      console.log(`mintingQueue: ${orders}`);
      if (orders.length === 0) {
        console.log("No orders in queue. Skipping this run.");
        return;
      }

      const { results, errors } = await PromisePool.withConcurrency(
        MAX_CONCURRENT_MINTS
      )
        .for(orders)
        .process(async (order) => {
          console.log(`Processing order: ${order.id}`);
          const orderItems = await orderItemRepository.getByOrderId(order.id);

          for (const orderItem of orderItems) {
            try {
              console.log(`Minting order item: ${orderItem.id}`);
              await mintOrderItem(orderItem, order);
              console.log(`Mint for order item: ${orderItem.id} is successful`);
            } catch (error) {
              console.error(`Error minting order item ${orderItem.id}:`, error);
              await orderItemRepository.update(orderItem.id, {
                status: "FAILED",
              });
              throw error;
            }
          }

          await orderRepository.update(order.id, { orderStatus: "DONE" });
          console.log(`Order ${order.id} processed successfully`);
          if (order.collectionId)
            await collectionRepository.update(order.collectionId, {
              type: "MINTED",
            });
        });

      console.log(
        `Minting queue process completed. Successful: ${results.length}, Failed: ${errors.length}`
      );
      if (errors.length > 0) {
        console.error("Errors occurred during minting:", errors);
      }
    } catch (error) {
      console.error("Error in minting queue process:", error);
    } finally {
      // Release the lock
      await redis.del(LOCK_KEY);
      console.log("Minting queue lock released.");
    }
  });
}

async function waitForTransactionConfirmation(
  txid: string,
  isTestNet: boolean
): Promise<boolean> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const txInfo = await getRawTransaction(txid, isTestNet);
      if (txInfo) {
        console.log(`Transaction ${txid} is confirmed.`);
        return true;
      }
      console.log(
        `Waiting for transaction ${txid} to be confirmed. Attempt ${
          i + 1
        }/${MAX_RETRIES}`
      );
    } catch (error) {
      console.error(`Error checking transaction ${txid}:`, error);
    }
    await sleep(RETRY_INTERVAL);
  }
  throw new Error(
    `Transaction ${txid} not confirmed after ${MAX_RETRIES} attempts`
  );
}

async function mintOrderItem(orderItem: OrderItemDetails, order: any) {
  if (orderItem.status === "MINTED" || orderItem.layer !== "FRACTAL") return; // TODO. Only for fractal for now. Adjust it later.
  const file = await getObjectFromS3(orderItem.fileKey);
  const user = await userRepository.getById(orderItem.userId);
  if (!user) throw new Error("User not found.");

  const tokenData = {
    address: user.address,
    xpub: null,
    opReturnValues: `data:${file.contentType};base64,${(
      file.content as Buffer
    ).toString("base64")}` as any,
    assetType: ASSETTYPE.NFTONCHAIN,
    supply: 1,
    headline: "headline",
    ticker: "test",
  };
  const isTestNet = orderItem.network !== "MAINNET";

  if (orderItem.layer === "FRACTAL") {
    const mintHexes = await mint(
      tokenData,
      order.fundingAddress,
      order.privateKey,
      isTestNet,
      SERVICE_FEE_ADDRESS[orderItem.layer][orderItem.network],
      SERVICE_FEE[orderItem.layer][orderItem.network],
      order.feeRate
    );

    const commitTxId = await sendRawTransactionWithNode(mintHexes!.commitTxHex);
    // console.log(`Commit transaction sent: ${commitTxId}`);

    // await waitForTransactionConfirmation(commitTxId, isTestNet);
    // console.log(
    //   `Commit transaction ${commitTxId} confirmed. Proceeding with reveal transaction.`
    // );

    const revealTxId = await sendRawTransactionWithNode(mintHexes!.revealTxHex);
    console.log(`Reveal transaction sent: ${revealTxId}`);

    await waitForTransactionConfirmation(revealTxId, isTestNet);
    console.log(`Reveal transaction ${revealTxId} confirmed.`);

    await orderItemRepository.update(orderItem.id, { status: "MINTED" });

    if (order.collectionId) {
      const collection = await collectionRepository.getById(order.collectionId);
      if (!collection) throw new Error("Collection not found.");

      const collectible = await collectibleRepository.getByUniqueIdx(
        `${collection.name} #${collection.supply}`
      );
      if (!collectible) {
        await collectibleRepository.create({
          fileKey: orderItem.fileKey,
          name: `${collection.name} #${collection.supply}`,
          collectionId: collection.id,
          uniqueIdx: `${revealTxId}i0`,
        });

        collection.supply++;
        await collectionRepository.update(collection.id, {
          supply: collection.supply,
        });
      }
    }
  } else {
    throw new Error(`Unsupported layer: ${orderItem.layer}`);
  }
}
