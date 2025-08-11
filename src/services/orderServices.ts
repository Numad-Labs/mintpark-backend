import { orderRepository } from "../repositories/orderRepostory";
import { userRepository } from "../repositories/userRepository";
import { layerRepository } from "../repositories/layerRepository";
import { uploadToS3 } from "../utils/aws";
import { randomUUID } from "crypto";
import { orderItemRepository } from "../repositories/orderItemRepository";
import { collectionServices } from "./collectionServices";
import { CustomError } from "../exceptions/CustomError";
import { collectionRepository } from "../repositories/collectionRepository";
import { Insertable } from "kysely";
import { Collectible, Order, OrderItem } from "../types/db/types";

import { EVM_CONFIG } from "../blockchain/evm/evm-config";
import { TransactionConfirmationService } from "../blockchain/evm/services/transactionConfirmationService";
import { db } from "../utils/db";
import { layerServices } from "./layerServices";
import { traitValueRepository } from "../repositories/traitValueRepository";
import logger from "../config/winston";
import { config } from "../config/config";
import { InscriptionPhase, InscriptionQueueItem } from "@queue/sqsProducer";
import { SQSProducer } from "@queue/sqsProducer";
import { collectionProgressRepository } from "@repositories/collectionProgressRepository";
import { collectionProgressServices } from "./collectionProgressServices";
import { getPSBTBuilder } from "@blockchain/bitcoin/PSBTBuilder";

export const producer = new SQSProducer("eu-central-1", config.AWS_SQS_URL);

export interface nftMetaData {
  nftId: string | null;
  name: string;
  file: Express.Multer.File | null;
  ipfsUri: string | null;
}

const BITCOIN_TXID_BYTE_SIZE = 32;

export const orderServices = {
  // createCollectible: async (
  //   userId: string,
  //   userLayerId: string,
  //   feeRate: number,
  //   files: Express.Multer.File[],
  //   collectionId?: string,
  //   txid?: string
  // ) => {
  //   if (files.length !== 1)
  //     throw new CustomError("Collectible order must have one file.", 400);

  //   if (!collectionId) throw new CustomError("Collection id is required.", 400);
  //   let collection = await collectionServices.getById(collectionId);
  //   if (!collection || !collection.id)
  //     throw new CustomError("Collection not found.", 400);

  //   const user = await userRepository.getByIdAndLayerId(
  //     userId,
  //     collection.layerId
  //   );
  //   if (!user) throw new CustomError("User not found.", 400);

  //   const nftMetadatas: nftMetaData[] = [];
  //   let index = 0;
  //   for (let file of files) {
  //     nftMetadatas.push({
  //       name: `${collection?.name ?? "NFT"} #${index}`,
  //       nftId: index.toString(),
  //       ipfsUri: null,
  //       file: file,
  //     });

  //     index++;
  //   }

  //   if (user.layer === "CITREA" && user.network === "TESTNET") {
  //     if (!txid) throw new CustomError("txid not found.", 400);
  //     const transactionDetail = await confirmationService.getTransactionDetails(
  //       txid
  //     );

  //     if (transactionDetail.status !== 1) {
  //       throw new CustomError(
  //         "Transaction not confirmed. Please try again.",
  //         500
  //       );
  //     }

  //     if (!transactionDetail.deployedContractAddress) {
  //       throw new CustomError(
  //         "Transaction does not contain deployed contract address.",
  //         500
  //       );
  //     }

  //     await collectionRepository.update(db, collection.id, {
  //       contractAddress: transactionDetail.deployedContractAddress,
  //     });

  //     const unsignedTx = await nftService.getUnsignedMintNFTTransaction(
  //       transactionDetail.deployedContractAddress,
  //       user.address,
  //       collection?.name ?? "NFT",
  //       files.length,
  //       files
  //     );

  //     const mintContractTxHex = JSON.parse(
  //       JSON.stringify(unsignedTx, (_, value) =>
  //         typeof value === "bigint" ? value.toString() : value
  //       )
  //     );
  //     const batchMintTxHex = mintContractTxHex;

  //     let networkFee = batchMintTxHex.gasLimit / 10 ** 9,
  //       serviceFee = 0;
  //     let totalAmount = networkFee + serviceFee;

  //     let order = await orderRepository.create(db, {
  //       userId: userId,
  //       fundingAmount: totalAmount,
  //       orderType: "MINT",
  //       feeRate: feeRate,
  //       userLayerId,
  //     });

  //     let insertableOrderItem = await uploadToS3AndReturnOrderItems(
  //       order.id,
  //       nftMetadatas
  //     );

  //     const orderItem = await orderItemRepository.create(
  //       insertableOrderItem[0]
  //     );

  //     return { order, orderItem, batchMintTxHex };
  //   } else if (user.layer === "FRACTAL" && user.network === "TESTNET") {
  //     let serviceFee = SERVICE_FEE[user.layer][user.network];
  //     const funder = createFundingAddress(user.layer, user.network);

  //     //Calculate fee
  //     const fileSizes = files.map((file) => file.buffer.length);
  //     const mimeTypeSizes = files.map((file) => file.mimetype.length);
  //     const { estimatedFee } = getEstimatedFee(
  //       fileSizes,
  //       mimeTypeSizes,
  //       serviceFee,
  //       feeRate
  //     );

  //     if (files.length !== 1)
  //       throw new CustomError("Collectible order must have one file.", 400);

  //     let order = await orderRepository.create(db, {
  //       userId: userId,
  //       fundingAddress: funder.address,
  //       fundingAmount: estimatedFee.totalAmount,
  //       privateKey: funder.privateKey,
  //       orderType: "MINT",
  //       feeRate: feeRate,
  //       userLayerId,
  //     });

  //     if (!order.id) throw new CustomError("No order id was found.", 400);

  //     let insertableOrderItem = await uploadToS3AndReturnOrderItems(
  //       order.id,
  //       nftMetadatas
  //     );

  //     const orderItem = await orderItemRepository.create(
  //       insertableOrderItem[0]
  //     );

  //     return { order, orderItem, batchMintTxHex: null };
  //   } else throw new Error("This layer is unsupported ATM.");
  // },
  createMintOrder: async (
    estimatedTxSizeInVBytes: number,
    totalDustValue: number,
    orderSplitCount = 5,
    collectionId: string,
    userId: string,
    userLayerId: string,
    txid?: string
  ) => {
    if (!collectionId) throw new CustomError("Collection id is required.", 400);
    const collection = await collectionServices.getById(collectionId);
    if (!collection) throw new CustomError("Collection not found.", 400);
    if (collection.type !== "SYNTHETIC")
      throw new CustomError("Invalid collection type", 400);
    if (collection.creatorId !== userId)
      // if (collection?.type === "SYNTHETIC" || collection.parentCollectionId)
      //   throw new CustomError(
      //     "You cannot create mint order for synthetic collection.",
      //     400
      //   );
      throw new CustomError("You are not the creator of this collection.", 400);
    if (!collection.parentCollectionId)
      throw new CustomError("Parent collection not found", 400);

    const parentCollection = await collectionRepository.getById(
      db,
      collection.parentCollectionId
    );
    if (!parentCollection)
      throw new CustomError("Parent collection not found", 400);

    const parentCollectionLayer = await layerRepository.getById(
      collection.layerId
    );
    if (!parentCollectionLayer)
      throw new CustomError("Parent collection's layer not found", 400);

    const hasExistingOrder = await orderRepository.getByCollectionId(
      collection.id
    );
    if (hasExistingOrder)
      throw new CustomError("This collection already has existing order.", 400);

    const user = await userRepository.getByUserLayerId(userLayerId);
    if (user?.id !== userId)
      throw new CustomError(
        "You are not allowed to create order for this account.",
        400
      );
    if (!user.isActive)
      throw new CustomError("This account is deactivated.", 400);
    await layerServices.checkIfSupportedLayerOrThrow(user.layerId);

    let order = await orderRepository.getByCollectionId(collection.id);
    if (order)
      throw new CustomError(
        "Mint order for this collection already exists.",
        400
      );
    if (orderSplitCount > 10)
      throw new CustomError("Order split count cannot be greater than 10", 400);
    if (estimatedTxSizeInVBytes < 546)
      throw new CustomError("Invalid fee amount", 400);

    const psbtBuilder = getPSBTBuilder(
      parentCollectionLayer.network === "MAINNET" ? "mainnet" : "testnet"
    );

    const feeRates = await psbtBuilder.fetchRecommendedFees();
    const funder = psbtBuilder.createFundingAddress();

    const feeRate = feeRates.priority;
    const networkFeeInSats = Math.ceil(
      (estimatedTxSizeInVBytes * feeRate + totalDustValue) * 1.1
    );
    const serviceFeeInSats = Math.max(Math.ceil(networkFeeInSats * 0.1), 10000);
    const fundingAmount = networkFeeInSats + serviceFeeInSats;

    order = await orderRepository.create(db, {
      userId: userId,
      fundingAmount,
      networkFeeInSats,
      serviceFeeInSats,
      fundingAddress: funder.address,
      privateKey: funder.privateKey,
      orderType: "MINT_RECURSIVE_COLLECTIBLE",
      collectionId: collection.id,
      feeRate: feeRate,
      orderSplitCount,
      userLayerId,
      isBase: true
    });

    const walletQrString = `bitcoin:${funder.address}?amount=${
      fundingAmount / 10 ** 8
    }`;

    return { order, walletQrString };
  },
  invokeOrderForMinting: async (userId: string, id: string) => {
    const order =
      await orderRepository.getOrderByIdAndMintRecursiveCollectibleType(id);
    if (!order) throw new CustomError("Order not found.", 400);
    if (!order.collectionId)
      throw new CustomError("Order does not have collectionId.", 400);
    if (order?.userId !== userId)
      throw new CustomError(
        "You are not allowed to create trait value for this collection.",
        400
      );
    if (!order.fundingAddress)
      throw new CustomError("Order does not have funding address", 400);
    if (!order.privateKey)
      throw new CustomError("Order does not have private key", 400);

    const user = await userRepository.getById(userId);
    if (!user) throw new CustomError("User not found", 400);

    const collection = await collectionRepository.getById(
      db,
      order.collectionId
    );
    if (!collection) throw new CustomError("Collection not found", 400);
    if (collection.creatorId !== user.id && user.role !== "SUPER_ADMIN")
      throw new CustomError("You are not allowed to do this action", 400);

    const layer = await layerRepository.getById(collection.layerId);
    if (!layer) throw new CustomError("Layer not found", 400);

    const collectionProgress = await collectionProgressRepository.getById(
      order.collectionId
    );
    if (!collectionProgress)
      throw new CustomError("Collection progress not found", 400);
    if (!collectionProgress.paymentCompleted)
      throw new CustomError("Please fund the order first", 400);
    if (collectionProgress.queued)
      throw new CustomError("Already been queued", 400);

    const psbtBuilder = getPSBTBuilder(
      layer.network === "MAINNET" ? "mainnet" : "testnet"
    );

    const serviceFeeRecipient =
      layer.network === "MAINNET"
        ? config.MAINNET_SERVICE_FEE_RECIPIENT_ADDRESS
        : config.TESTNET_SERVICE_FEE_RECIPIENT_ADDRESS;

    if (order.orderSplitCount === 1) {
      if (!order.hasTransferredServiceFee) {
        const txHex = await psbtBuilder.generateTxHex({
          outputs: [
            { address: serviceFeeRecipient, amount: order.serviceFeeInSats }
          ],
          fundingAddress: order.fundingAddress,
          fundingPrivateKey: order.privateKey,
          feeRate: order.feeRate
        });

        await db.transaction().execute(async (trx) => {
          await orderRepository.update(trx, order.id, {
            hasTransferredServiceFee: true
          });
          await collectionProgressServices.update(db, order.collectionId!, {
            queued: true
          });
          await psbtBuilder.broadcastTransaction(txHex);
        });
      }

      await producer.sendMessage(
        {
          orderId: order.id,
          collectionId: order.collectionId,
          phase: InscriptionPhase.TRAIT
        },
        60
      );
      console.log(
        `Enqueued inscription queue item: ${JSON.stringify({
          orderId: order.id,
          collectionId: order.collectionId,
          phase: InscriptionPhase.TRAIT
        })} at ${new Date().toISOString()} to Inscription Processor Queue`
      );

      return { order };
    }

    const orders = await orderRepository.checkIfOrderHasBeenSplitByCollectionId(
      order.collectionId
    );
    const hasBeenSplit = orders.length > 1;
    if (hasBeenSplit) {
      const traitQueueItem: InscriptionQueueItem[] = [];
      orders.forEach((order) => {
        traitQueueItem.push({
          orderId: order.id,
          collectionId: order.collectionId!,
          phase: InscriptionPhase.TRAIT
        });
      });

      try {
        const queuePromises = traitQueueItem.map((item) => {
          producer.sendMessage(item, 60);
        });
        await Promise.all(queuePromises);
        console.log(
          `Enqueued inscription queue item: ${JSON.stringify(
            traitQueueItem
          )} at ${new Date().toISOString()} to Inscription Processor Queue`
        );
      } catch (e) {
        console.log(e);
      }

      return { order };
    }

    // Improve fee validation
    const traitQueueItems: InscriptionQueueItem[] = [];
    traitQueueItems.push({
      orderId: order.id,
      collectionId: order.collectionId,
      phase: InscriptionPhase.TRAIT
    });

    const estimatedFee = psbtBuilder.estimateFee(
      1,
      order.orderSplitCount + 1,
      "p2tr",
      order.feeRate
    );

    const orderToCreate: Insertable<Order>[] = [];
    const splitNetworkFeeInSats = Math.floor(
      (order.networkFeeInSats - estimatedFee * 1.25) / order.orderSplitCount
    );

    const outputs: { address: string; amount: number }[] = [];
    outputs.push({
      address: order.fundingAddress,
      amount: splitNetworkFeeInSats
    });

    for (let i = 1; i < order.orderSplitCount; i++) {
      const funder = psbtBuilder.createFundingAddress();
      const newOrderId = randomUUID();
      orderToCreate.push({
        id: newOrderId,
        userId: userId,
        fundingAmount: order.fundingAmount,
        fundingAddress: funder.address,
        serviceFeeInSats: order.serviceFeeInSats,
        networkFeeInSats: splitNetworkFeeInSats,
        privateKey: funder.privateKey,
        orderType: "MINT_RECURSIVE_COLLECTIBLE",
        collectionId: order.collectionId,
        feeRate: order.feeRate,
        orderSplitCount: order.orderSplitCount,
        userLayerId: order.userLayerId,
        hasTransferredServiceFee: true
      });
      traitQueueItems.push({
        orderId: newOrderId,
        collectionId: order.collectionId,
        phase: InscriptionPhase.TRAIT
      });
      outputs.push({ address: funder.address, amount: splitNetworkFeeInSats });
    }

    outputs.push({
      address: serviceFeeRecipient,
      amount: order.serviceFeeInSats
    });

    const txHex = await psbtBuilder.generateTxHex({
      outputs,
      fundingAddress: order.fundingAddress,
      fundingPrivateKey: order.privateKey,
      feeRate: order.feeRate
    });

    await db.transaction().execute(async (trx) => {
      await orderRepository.bulkInsert(trx, orderToCreate);
      await orderRepository.update(trx, order.id, {
        networkFeeInSats: splitNetworkFeeInSats,
        hasTransferredServiceFee: true
      });
      await collectionProgressServices.update(db, order.collectionId!, {
        queued: true
      });
      await psbtBuilder.broadcastTransaction(txHex);
    });

    try {
      const queuePromises = traitQueueItems.map((item) => {
        producer.sendMessage(item, 60);
      });
      await Promise.all(queuePromises);
      console.log(
        `Enqueued inscription queue item: ${JSON.stringify(
          traitQueueItems
        )} at ${new Date().toISOString()} to Inscription Processor Queue`
      );
    } catch (e) {
      console.log(e);
    }

    return { order };

    // const collection = await collectionRepository.getById(
    //   db,
    //   order.collectionId
    // );
    // if (!collection) throw new CustomError("No collection found.", 400);
    // if (!order.fundingAddress)
    //   throw new CustomError("Invalid order with undefined address.", 400);

    // if (
    //   collection.type === "INSCRIPTION" ||
    //   collection.type === "RECURSIVE_INSCRIPTION"
    // ) {
    //   const balance = await getBalance(order.fundingAddress);
    //   if (balance < order.fundingAmount)
    //     throw new CustomError("Fee has not been transferred yet.", 400);
    // } else if (
    //   collection.type === "IPFS_CID" ||
    //   collection.type === "IPFS_FILE"
    // ) {
    //   //DG TODO: VALIDATE IF VAULT HAS BEEN FUNDED BY order.fundingAmount
    // }

    // await orderItemRepository.updateByOrderId(order.id, { status: "IN_QUEUE" });
    // const updatedOrder = await orderRepository.update(db, order.id, {
    //   orderStatus: "IN_QUEUE"
    // });

    // const orderItems: Insertable<OrderItem>[] = [];
    // if (collection.type === "RECURSIVE_INSCRIPTION") {
    //   const traitValues = await traitValueRepository.getByCollectionId(
    //     collection.id
    //   );

    //   for (let i = 0; i < traitValues.length; i++)
    //     orderItems.push({
    //       orderId: order.id,
    //       traitValueId: traitValues[i].id,
    //       type: "TRAIT"
    //     });

    //   await orderItemRepository.bulkInsert(orderItems);
    // }

    // // producer.sendMessage(order.id, 5);
    // logger.info(`Enqueued ${order.id} to the SQS`);
    // // if collection.type === 'RECURSIVE_INSCRIPTION', then invoke the trait minting first
  },
  getByUserId: async (userId: string) => {
    const orders = await orderRepository.getByUserId(userId);
    return orders;
  },
  getById: async (orderId: string) => {
    const order = await orderRepository.getById(db, orderId);
    return order;
  }
};
