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
import { Collectible } from "../types/db/types";
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
  name: string | null;
  file: Express.Multer.File | null;
  ipfsUri: string | null;
}

export const orderServices = {
  createCollectible: async (
    userId: string,
    feeRate: number,
    files: Express.Multer.File[],
    collectionId?: string,
    txid?: string
  ) => {
    const user = await userRepository.getByIdWithLayer(userId);
    if (!user) throw new Error("User not found.");

    if (!collectionId) throw new Error("Collection id is required.");
    let collection = await collectionServices.getById(collectionId);
    if (!collection || !collection.id) throw new Error("Collection not found.");

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
      if (!txid) throw new Error("txid not found.");
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

      await collectionRepository.update(collection.id, {
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

      if (files.length !== 1)
        throw new Error("Collectible order must have one file.");

      let order = await orderRepository.create({
        userId: userId,
        quantity: files.length,
        fundingAmount: totalAmount,
        networkFee: networkFee,
        serviceFee: serviceFee,
        orderType: "COLLECTIBLE",
        feeRate: feeRate,
      });

      let orderItems = await uploadToS3AndCreateOrderItems(
        order.id,
        nftMetadatas
      );

      return { order, orderItems, batchMintTxHex };
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
        throw new Error("Collectible order must have one file.");

      let order = await orderRepository.create({
        userId: userId,
        quantity: files.length,
        fundingAddress: funder.address,
        fundingAmount: estimatedFee.totalAmount,
        networkFee: estimatedFee.networkFee,
        serviceFee: estimatedFee.serviceFee,
        privateKey: funder.privateKey,
        orderType: "COLLECTIBLE",
        feeRate: feeRate,
      });

      if (!order.id) throw new CustomError("No order id was found.", 400);

      let orderItems = await uploadToS3AndCreateOrderItems(
        order.id,
        nftMetadatas
      );

      return { order, orderItems, batchMintTxHex: null };
    } else throw new Error("This layer is unsupported ATM.");
  },
  createCollection: async (
    userId: string,
    feeRate: number,
    files: Express.Multer.File[],
    totalFileCount: number,
    collectionId?: string,
    txid?: string
  ) => {
    const user = await userRepository.getByIdWithLayer(userId);
    if (!user) throw new Error("User not found.");

    if (!collectionId) throw new Error("Collection id is required.");
    let collection = await collectionServices.getById(collectionId);
    if (!collection || !collection.id) throw new Error("Collection not found.");

    const totalBatches = Math.ceil(totalFileCount / FILE_COUNT_LIMIT);
    const slotAcquired = await acquireSlot(collectionId, totalBatches);
    if (!slotAcquired) {
      throw new CustomError(
        "The upload system is at maximum capacity. Please wait a moment and try again.",
        400
      );
    }

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
      if (!txid) throw new Error("txid not found.");
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

      await collectionRepository.update(collection.id, {
        contractAddress: transactionDetail.deployedContractAddress,
      });

      let networkFee = 0,
        serviceFee = 0;
      let totalAmount = networkFee + serviceFee;

      if (files.length < 1)
        throw new Error(
          "Collection order must have at least one collectible file."
        );
      if (!collection) throw new Error("Collection not found.");

      let order = await orderRepository.getByCollectionId(collection.id);
      if (!order) {
        order = await orderRepository.create({
          userId: userId,
          quantity: totalFileCount,
          fundingAmount: totalAmount,
          networkFee: networkFee,
          serviceFee: serviceFee,
          orderType: "COLLECTION",
          collectionId: collection.id,
          feeRate: feeRate,
        });
      }

      let orderItems;
      try {
        //only upload to S3 & IPFS
        //attach ipfs url to the nftMetadatas list
        const nftUrls = await nftService.uploadNftImagesToIpfs(
          // transactionDetail.deployedContractAddress,
          // user.address,
          collection.name,
          files.length,
          files
        );
        nftMetadatas.forEach((metadata, index) => {
          metadata.ipfsUri = nftUrls[index];
        });

        orderItems = await uploadToS3AndCreateOrderItems(
          order.id,
          nftMetadatas
        );
      } catch (e) {
        forceReleaseSlot(collectionId);
        throw e;
      }

      // const mintContractTxHex = JSON.parse(
      //   JSON.stringify(unsignedTx, (_, value) =>
      //     typeof value === "bigint" ? value.toString() : value
      //   )
      // );
      // const batchMintTxHex = mintContractTxHex;

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

      console.log(estimatedFee);

      if (files.length < 1)
        throw new Error(
          "Collection order must have at least one collectible file."
        );
      if (!collection) throw new Error("Collection not found.");

      let order = await orderRepository.getByCollectionId(collection.id);
      if (!order) {
        order = await orderRepository.create({
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

      let orderItems = await uploadToS3AndCreateOrderItems(
        order.id,
        nftMetadatas
      );

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
  generateMintTxHex: async (orderId: string, issuerId: string) => {
    const issuer = await userRepository.getByIdWithLayer(issuerId);
    if (!issuer) throw new CustomError("No user found.", 400);

    const order = await orderRepository.getById(orderId);
    if (!order) throw new CustomError("Order user found.", 400);

    const orderItems = await orderItemRepository.getByOrderId(order.id);
    if (orderItems.length <= 1)
      throw new CustomError("Insufficient order items.", 400);

    if (issuer.layer === "CITREA") {
      if (!order.collectionId)
        throw new CustomError("Couldn't find collection id.", 400);
      const collection = await collectionRepository.getById(order.collectionId);

      if (!collection?.contractAddress) {
        throw new CustomError(
          "Couldn't find collection contract address.",
          400
        );
      }
      const ipfsUrls = orderItems
        .map((item) => item.ipfsUrl)
        .filter((url): url is string => url !== null);

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
  checkOrderisPaid: async (orderId: string, txid?: string) => {
    // Check payment status
    // If payment is confirmed, return true else false
    try {
      const order = await orderRepository.getById(orderId);
      if (!order) throw new Error("Order not found.");
      if (order.paidAt && order.orderStatus !== "PENDING") return true;

      const user = await userRepository.getById(order.userId);
      if (!user) throw new Error("User not found.");

      const layer = await layerRepository.getById(user.layerId!);
      if (!layer) throw new Error("Layer not found.");

      let collection;
      if (order.orderType === "COLLECTION" && order.collectionId) {
        collection = await collectionRepository.getById(order.collectionId);
      }

      if (layer.layer === "CITREA" && layer.network === "TESTNET") {
        /*
          if user.layer is citrea(add txid parameter)
          validate order by txid
          updates order & orderItems status to be DONE & MINTED
          sets collectionId to MINTED
          inserts the orderItems into collectibles
          return true
        */
        if (!txid) throw new CustomError("txid is missing", 500);

        const transactionDetail =
          await confirmationService.getTransactionDetails(txid);

        if (transactionDetail.status !== 1) {
          throw new CustomError(
            "Transaction not confirmed. Please try again.",
            500
          );
        }

        const orderItemCount = await orderRepository.getByCollectionId(orderId);
        if (Number(orderItemCount) < order.quantity) {
          return true;
        }

        order.paidAt = new Date();
        await orderRepository.update(order.id, {
          paidAt: order.paidAt,
          orderStatus: "DONE",
          txId: txid,
        });

        const orderItems = await orderItemRepository.updateByOrderId(order.id, {
          status: "MINTED",
        });

        if (collection && collection.id) {
          console.log(collection);
          if (collection?.type === "UNCONFIRMED" && order.collectionId)
            await collectionRepository.update(order.collectionId, {
              type: "MINTED",
              supply: orderItems.length,
            });

          const collectibles: Insertable<Collectible>[] = [];
          for (const orderItem of orderItems) {
            if (collection?.id && orderItem.evmAssetId) {
              collectibles.push({
                collectionId: collection.id,
                uniqueIdx: `${collection.contractAddress}i${orderItem.evmAssetId}`,
                name: orderItem.name,
                fileKey: orderItem.fileKey,
              });
            }
          }

          console.log(collectibles);

          if (collectibles.length > 0)
            await collectibleRepository.bulkInsert(collectibles);
        }

        return true;
      } else if (layer.layer === "FRACTAL" && layer.network === "TESTNET") {
        let isTestNet = true;
        if (!order.fundingAddress)
          throw new CustomError("No funding address was provided.", 400);
        // if (layer.network === "MAINNET") isTestNet = false;
        const utxos = await getUtxosHelper(
          order.fundingAddress,
          isTestNet,
          layer.layer
        );
        const totalAmount = utxos.reduce((a, b) => a + b.satoshi, 0);

        if (totalAmount >= order.fundingAmount) {
          order.paidAt = new Date();
          await orderRepository.update(order.id, {
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

async function uploadToS3AndCreateOrderItems(
  orderId: string,
  nftMetadatas: nftMetaData[]
): Promise<any[]> {
  return await Promise.all(
    nftMetadatas.map(async (metadata) => {
      const key = randomUUID();
      if (metadata.file) await uploadToS3(key, metadata.file);
      return await orderItemRepository.create({
        orderId,
        fileKey: key,
        name: metadata.name,
        evmAssetId: metadata.nftId,
        ipfsUrl: metadata.ipfsUri,
      });
    })
  );
}
