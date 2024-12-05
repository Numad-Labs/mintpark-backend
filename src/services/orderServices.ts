import { orderRepository } from "../repositories/orderRepostory";
import { ORDER_TYPE } from "../types/db/enums";
import { createFundingAddress } from "../../blockchain/utxo/fundingAddressHelper";
import { userRepository } from "../repositories/userRepository";
import { layerRepository } from "../repositories/layerRepository";
import { SERVICE_FEE } from "../../blockchain/utxo/constants";
import { uploadToS3 } from "../utils/aws";
import { randomUUID } from "crypto";
import { orderItemRepository } from "../repositories/orderItemRepository";
import { collectionServices } from "./collectionServices";
import { getUtxosHelper } from "../../blockchain/utxo/getUtxosHelper";
import { getEstimatedFee } from "../../blockchain/utxo/calculateRequiredAmount";
import { CustomError } from "../exceptions/CustomError";
import { collectionRepository } from "../repositories/collectionRepository";
import { Insertable } from "kysely";
import { Collectible, OrderItem } from "../types/db/types";
import { collectibleRepository } from "../repositories/collectibleRepository";

import { EVM_CONFIG } from "../../blockchain/evm/evm-config";
import NFTService from "../../blockchain/evm/services/nftService";
import MarketplaceService from "../../blockchain/evm/services/marketplaceService";
import { TransactionConfirmationService } from "../../blockchain/evm/services/transactionConfirmationService";
import {
  acquireSlot,
  forceReleaseSlot,
  updateProgress,
} from "../libs/uploadLimiter";
import { FILE_COUNT_LIMIT } from "../libs/constants";
import { serializeBigInt } from "../../blockchain/evm/utils";
import { db } from "../utils/db";

const nftService = new NFTService(
  EVM_CONFIG.RPC_URL,
  EVM_CONFIG.MARKETPLACE_ADDRESS,
  new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS)
);
const confirmationService = new TransactionConfirmationService(
  EVM_CONFIG.RPC_URL!
);

export interface nftMetaData {
  nftId: string | null;
  name: string;
  file: Express.Multer.File | null;
  ipfsUri: string | null;
}

export const orderServices = {
  createCollectible: async (
    userId: string,
    userLayerId: string,
    feeRate: number,
    files: Express.Multer.File[],
    collectionId?: string,
    txid?: string
  ) => {
    if (files.length !== 1)
      throw new CustomError("Collectible order must have one file.", 400);

    if (!collectionId) throw new CustomError("Collection id is required.", 400);
    let collection = await collectionServices.getById(collectionId);
    if (!collection || !collection.id)
      throw new CustomError("Collection not found.", 400);

    const user = await userRepository.getByIdAndLayerId(
      userId,
      collection.layerId
    );
    if (!user) throw new CustomError("User not found.", 400);

    const nftMetadatas: nftMetaData[] = [];
    let index = 0;
    for (let file of files) {
      nftMetadatas.push({
        name: `${collection?.name ?? "NFT"} #${index}`,
        nftId: index.toString(),
        ipfsUri: null,
        file: file,
      });

      index++;
    }

    if (user.layer === "CITREA" && user.network === "TESTNET") {
      if (!txid) throw new CustomError("txid not found.", 400);
      const transactionDetail = await confirmationService.getTransactionDetails(
        txid
      );

      if (transactionDetail.status !== 1) {
        throw new CustomError(
          "Transaction not confirmed. Please try again.",
          500
        );
      }

      if (!transactionDetail.deployedContractAddress) {
        throw new CustomError(
          "Transaction does not contain deployed contract address.",
          500
        );
      }

      await collectionRepository.update(db, collection.id, {
        contractAddress: transactionDetail.deployedContractAddress,
      });

      const unsignedTx = await nftService.getUnsignedMintNFTTransaction(
        transactionDetail.deployedContractAddress,
        user.address,
        collection?.name ?? "NFT",
        files.length,
        files
      );

      const mintContractTxHex = JSON.parse(
        JSON.stringify(unsignedTx, (_, value) =>
          typeof value === "bigint" ? value.toString() : value
        )
      );
      const batchMintTxHex = mintContractTxHex;

      let networkFee = batchMintTxHex.gasLimit / 10 ** 9,
        serviceFee = 0;
      let totalAmount = networkFee + serviceFee;

      let order = await orderRepository.create(db, {
        userId: userId,
        fundingAmount: totalAmount,
        orderType: "MINT",
        feeRate: feeRate,
        userLayerId,
      });

      let insertableOrderItem = await uploadToS3AndReturnOrderItems(
        order.id,
        nftMetadatas
      );

      const orderItem = await orderItemRepository.create(
        insertableOrderItem[0]
      );

      return { order, orderItem, batchMintTxHex };
    } else if (user.layer === "FRACTAL" && user.network === "TESTNET") {
      let serviceFee = SERVICE_FEE[user.layer][user.network];
      const funder = createFundingAddress(user.layer, user.network);

      //Calculate fee
      const fileSizes = files.map((file) => file.buffer.length);
      const mimeTypeSizes = files.map((file) => file.mimetype.length);
      const { estimatedFee } = getEstimatedFee(
        fileSizes,
        mimeTypeSizes,
        serviceFee,
        feeRate
      );

      if (files.length !== 1)
        throw new CustomError("Collectible order must have one file.", 400);

      let order = await orderRepository.create(db, {
        userId: userId,
        fundingAddress: funder.address,
        fundingAmount: estimatedFee.totalAmount,
        privateKey: funder.privateKey,
        orderType: "MINT",
        feeRate: feeRate,
        userLayerId,
      });

      if (!order.id) throw new CustomError("No order id was found.", 400);

      let insertableOrderItem = await uploadToS3AndReturnOrderItems(
        order.id,
        nftMetadatas
      );

      const orderItem = await orderItemRepository.create(
        insertableOrderItem[0]
      );

      return { order, orderItem, batchMintTxHex: null };
    } else throw new Error("This layer is unsupported ATM.");
  },
  createCollection: async (
    userId: string,
    userLayerId: string,
    feeRate: number,
    files: Express.Multer.File[],
    totalFileCount: number,
    collectionId?: string,
    txid?: string
  ) => {
    if (!collectionId) throw new CustomError("Collection id is required.", 400);
    let collection = await collectionServices.getById(collectionId);
    if (!collection || !collection.id)
      throw new CustomError("Collection not found.", 400);

    const user = await userRepository.getByIdAndLayerId(
      userId,
      collection.layerId
    );
    if (!user) throw new CustomError("User not found.", 400);

    const totalBatches = Math.ceil(totalFileCount / FILE_COUNT_LIMIT);
    if (totalBatches < 1 || files.length < 1)
      throw new CustomError("Insufficient file count.", 400);

    const slotAcquired = await acquireSlot(collectionId, totalBatches);
    if (!slotAcquired)
      throw new CustomError(
        "The minting service is at maximum capacity. Please wait a moment and try again.",
        400
      );

    const orderItemCount = await orderItemRepository.getCountByCollectionId(
      collectionId
    );
    const nftMetadatas: nftMetaData[] = [];
    let index = 0;
    for (let file of files) {
      let nftId = Number(orderItemCount) + index;

      nftMetadatas.push({
        name: `${collection.name} #${nftId}`,
        nftId: nftId.toString(),
        ipfsUri: null,
        file: file,
      });

      index++;
    }

    if (user.layer === "CITREA" && user.network === "TESTNET") {
      if (!txid) throw new CustomError("txid not found.", 400);
      const transactionDetail = await confirmationService.getTransactionDetails(
        txid
      );

      if (transactionDetail.status !== 1) {
        throw new CustomError(
          "Transaction not confirmed. Please try again.",
          500
        );
      }

      if (!transactionDetail.deployedContractAddress) {
        throw new CustomError(
          "Transaction does not contain deployed contract address.",
          500
        );
      }

      await collectionRepository.update(db, collection.id, {
        contractAddress: transactionDetail.deployedContractAddress,
      });

      let networkFee = 0,
        serviceFee = 0;
      let totalAmount = networkFee + serviceFee;

      let order = await orderRepository.getByCollectionId(collection.id);
      if (!order) {
        order = await orderRepository.create(db, {
          userId: userId,
          fundingAmount: totalAmount,
          orderType: "MINT",
          collectionId: collection.id,
          feeRate: feeRate,
          userLayerId,
        });
      }

      let orderItems, insertableOrderItems, nftUrls: any;
      try {
        //only upload to S3 & IPFS
        //attach ipfs url to the nftMetadatas list
        // nftUrls = await nftService.uploadNftImagesToIpfs(
        //   collection.name,
        //   files.length,
        //   files
        // );
        // insertableOrderItems = await uploadToS3AndReturnOrderItems(
        //   order.id,
        //   nftMetadatas
        // );

        [nftUrls, insertableOrderItems] = await Promise.all([
          nftService.uploadNftImagesToIpfs(
            collection.name,
            files.length,
            files
          ),
          uploadToS3AndReturnOrderItems(order.id, nftMetadatas),
        ]);

        insertableOrderItems.forEach((metadata, index) => {
          metadata. = nftUrls[index];
        });
      } catch (e) {
        forceReleaseSlot(collectionId);
        throw e;
      }

      //TODO: metadata support
      orderItems = await orderItemRepository.bulkInsert(insertableOrderItems);

      const isComplete = await updateProgress(collectionId);

      return { order, orderItems, isComplete };
    } else if (user.layer === "FRACTAL" && user.network === "TESTNET") {
      let serviceFee = SERVICE_FEE[user.layer][user.network];
      const funder = createFundingAddress(user.layer, user.network);

      //Calculate fee
      const fileSizes = files.map((file) => file.buffer.length);
      const mimeTypeSizes = files.map((file) => file.mimetype.length);
      const { estimatedFee } = getEstimatedFee(
        fileSizes,
        mimeTypeSizes,
        serviceFee,
        feeRate
      );

      if (files.length < 1)
        throw new CustomError(
          "Collection order must have at least one collectible file.",
          400
        );
      if (!collection) throw new CustomError("Collection not found.", 400);

      let order = await orderRepository.getByCollectionId(collection.id);
      if (!order) {
        order = await orderRepository.create(db, {
          userId: userId,
          quantity: files.length,
          fundingAddress: funder.address,
          fundingAmount: estimatedFee.totalAmount,
          networkFee: estimatedFee.networkFee,
          serviceFee: estimatedFee.serviceFee,
          privateKey: funder.privateKey,
          orderType: "COLLECTION",
          collectionId: collection.id,
          feeRate: feeRate,
        });
      }

      let orderItems, insertableOrderItems;
      try {
        insertableOrderItems = await uploadToS3AndReturnOrderItems(
          order.id,
          nftMetadatas
        );
      } catch (e) {
        forceReleaseSlot(collectionId);
        throw e;
      }

      //TODO: metadata support
      orderItems = await orderItemRepository.bulkInsert(insertableOrderItems);

      const isComplete = await updateProgress(collectionId);

      return { order, orderItems, isComplete };
    } else throw new Error("This layer is unsupported ATM.");
  },
  getByUserId: async (userId: string) => {
    const orders = await orderRepository.getByUserId(userId);
    return orders;
  },
  getById: async (orderId: string) => {
    const order = await orderRepository.getById(orderId);
    return order;
  },
  generateMintTxHex: async (
    orderId: string,
    layerId: string,
    issuerId: string
  ) => {
    const issuer = await userRepository.getByIdAndLayerId(issuerId, layerId);
    if (!issuer) throw new CustomError("No user found.", 400);

    const order = await orderRepository.getById(orderId);
    if (!order) throw new CustomError("Order user found.", 400);
    if (!order.collectionId)
      throw new CustomError("Couldn't find collection id.", 400);

    const orderItems = await orderItemRepository.getByOrderId(order.id);
    if (orderItems.length <= 1 || orderItems.length < order.quantity)
      throw new CustomError("Insufficient order items.", 400);

    if (issuer.layer === "CITREA") {
      const collection = await collectionRepository.getById(
        db,
        order.collectionId
      );

      if (!collection?.contractAddress)
        throw new CustomError(
          "Couldn't find collection contract address.",
          400
        );

      const ipfsUrls = orderItems
        .map((item) => item.ipfsUrl)
        .filter((url): url is string => url !== null);

      //TODO: metadata support
      const unsignedTx = await nftService.getUnsignedBatchMintNFTTransaction(
        collection?.contractAddress,
        issuer.address,
        orderItems.length,
        ipfsUrls
      );

      const batchMintTxHex = serializeBigInt(unsignedTx);

      return { order, batchMintTxHex };
    } else throw new Error("This layer is unsupported ATM.");
  },
  checkOrderisPaid: async (orderId: string, layerId: string, txid?: string) => {
    // Check payment status
    // If payment is confirmed, return true else false
    try {
      const order = await orderRepository.getById(orderId);
      if (!order) throw new CustomError("Order not found.", 400);
      if (order.paidAt && order.orderStatus !== "PENDING") return true;

      const user = await userRepository.getByIdAndLayerId(
        order.userId,
        layerId
      );
      if (!user) throw new CustomError("User not found.", 400);

      if (user.layer === "CITREA" && user.network === "TESTNET") {
        if (!txid) throw new CustomError("txid is missing", 400);

        const transactionDetail =
          await confirmationService.getTransactionDetails(txid);

        if (transactionDetail.status !== 1) {
          throw new CustomError(
            "Transaction not confirmed. Please try again.",
            500
          );
        }

        if (order.orderType === "COLLECTIBLE" || !order.collectionId) {
          order.paidAt = new Date();
          await orderRepository.update(db, order.id, {
            paidAt: order.paidAt,
            orderStatus: "DONE",
            txId: txid,
          });

          const orderItems = await orderItemRepository.updateByOrderId(
            order.id,
            {
              status: "MINTED",
            }
          );

          return true;
        }

        const collection = await collectionRepository.getById(
          db,
          order.collectionId
        );
        const orderItemCount = await orderItemRepository.getCountByCollectionId(
          order.collectionId
        );

        const orderItems = await orderItemRepository.updateByOrderId(order.id, {
          status: "MINTED",
          txid: txid,
        });

        const collectibles: Insertable<Collectible>[] = [];
        for (const orderItem of orderItems) {
          if (collection?.id && orderItem.evmAssetId) {
            collectibles.push({
              collectionId: collection.id,
              uniqueIdx: `${collection.contractAddress}i${orderItem.evmAssetId}`,
              name: orderItem.name,
              fileKey: orderItem.fileKey,
              txid: orderItem.txid,
            });
          }
        }

        //TODO: metadata support
        await collectibleRepository.bulkInsert(collectibles);

        if (Number(orderItemCount) === order.quantity) {
          order.paidAt = new Date();
          await orderRepository.update(db, order.id, {
            paidAt: order.paidAt,
            orderStatus: "DONE",
            txId: txid,
          });

          if (collection?.type === "UNCONFIRMED")
            await collectionRepository.update(db, order.collectionId, {
              type: "MINTED",
              supply: Number(orderItemCount),
            });
        }

        return true;
      } else if (user.layer === "FRACTAL" && user.network === "TESTNET") {
        let isTestNet = true;
        if (!order.fundingAddress)
          throw new CustomError("No funding address was provided.", 400);
        // if (layer.network === "MAINNET") isTestNet = false;
        const utxos = await getUtxosHelper(
          order.fundingAddress,
          isTestNet,
          user.layer
        );
        const totalAmount = utxos.reduce((a, b) => a + b.satoshi, 0);

        if (totalAmount >= order.fundingAmount) {
          order.paidAt = new Date();
          await orderRepository.update(db, order.id, {
            paidAt: order.paidAt,
            orderStatus: "IN_QUEUE",
          });
          return true;
        }
        return false;
      } else throw new Error("This layer unsupported ATM.");
    } catch (error) {
      throw error;
    }
  },
};

// async function uploadToS3AndCreateOrderItems(
//   orderId: string,
//   nftMetadatas: nftMetaData[]
// ): Promise<any[]> {
//   return await Promise.all(
//     nftMetadatas.map(async (metadata) => {
//       const key = randomUUID();
//       if (metadata.file) await uploadToS3(key, metadata.file);
//       return await orderItemRepository.create({
//         orderId,
//         fileKey: key,
//         name: metadata.name,
//         evmAssetId: metadata.nftId,
//         ipfsUrl: metadata.ipfsUri,
//       });
//     })
//   );
// }

async function uploadToS3AndReturnOrderItems(
  orderId: string,
  nftMetadatas: nftMetaData[]
): Promise<Insertable<OrderItem>[]> {
  return await Promise.all(
    nftMetadatas.map(async (metadata) => {
      const key = randomUUID();
      if (metadata.file) await uploadToS3(key, metadata.file);
      return {
        orderId,
      };
    })
  );
}
