import { orderRepository } from "../repositories/orderRepostory";
import { ORDER_TYPE } from "../types/db/enums";
import { userRepository } from "../repositories/userRepository";
import { layerRepository } from "../repositories/layerRepository";
import { uploadToS3 } from "../utils/aws";
import { randomUUID } from "crypto";
import { orderItemRepository } from "../repositories/orderItemRepository";
import { collectionServices } from "./collectionServices";
import { CustomError } from "../exceptions/CustomError";
import { collectionRepository } from "../repositories/collectionRepository";
import { Insertable } from "kysely";
import { Collectible, OrderItem } from "../types/db/types";
import { collectibleRepository } from "../repositories/collectibleRepository";

import { EVM_CONFIG } from "../../blockchain/evm/evm-config";
import NFTService from "../../blockchain/evm/services/nftService";
import MarketplaceService from "../../blockchain/evm/services/marketplaceService";
import { TransactionConfirmationService } from "../../blockchain/evm/services/transactionConfirmationService";
import { FILE_COUNT_LIMIT } from "../libs/constants";
import { serializeBigInt } from "../../blockchain/evm/utils";
import { db } from "../utils/db";
import { userLayerRepository } from "../repositories/userLayerRepository";
import { layerServices } from "./layerServices";
import { traitValueRepository } from "../repositories/traitValueRepository";
import { TransactionValidationService } from "../../blockchain/evm/services/evmTransactionValidationService";
import { getBalance, getEstimatedFee } from "../blockchain/bitcoin/libs";
import { createFundingAddress } from "../blockchain/bitcoin/createFundingAddress";
import {
  COMMIT_TX_SIZE,
  REVEAL_TX_SIZE,
} from "../blockchain/bitcoin/constants";
import { producer } from "..";
import logger from "../config/winston";
import LaunchpadService from "../../blockchain/evm/services/launchpadService";
import { config } from "../config/config";
const nftService = new NFTService(
  EVM_CONFIG.RPC_URL,
  EVM_CONFIG.MARKETPLACE_ADDRESS,
  new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS)
);
const confirmationService = new TransactionConfirmationService(
  EVM_CONFIG.RPC_URL!
);

const launchPadService = new LaunchpadService(
  EVM_CONFIG.RPC_URL,
  new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS)
);

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
    userId: string,
    userLayerId: string,
    totalFileSize: number,
    totalTraitCount: number,
    totalCollectibleCount: number,
    feeRate: number,
    collectionId: string,
    txid?: string
  ) => {
    if (!collectionId) throw new CustomError("Collection id is required.", 400);
    const collection = await collectionServices.getById(collectionId);
    if (!collection) throw new CustomError("Collection not found.", 400);
    if (collection?.type === "SYNTHETIC" || collection.parentCollectionId)
      throw new CustomError(
        "You cannot create mint order for synthetic collection.",
        400
      );
    if (collection.creatorId !== userId)
      throw new CustomError("You are not the creator of this collection.", 400);

    let childCollection;
    if (collection.type !== "IPFS") {
      childCollection =
        await collectionRepository.getChildCollectionByParentCollectionId(
          collection.id
        );
      if (!childCollection)
        throw new CustomError("Child collection not found.", 400);
    }

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

    if (user.layer === "CITREA" && user.network === "TESTNET") {
      // const user = await userRepository.getByIdAndLayerId(
      //   userId,
      //   collection.layerId
      // );
      // if (!user) throw new CustomError("User not found.", 400);

      // const totalBatches = Math.ceil(totalFileCount / FILE_COUNT_LIMIT);
      // if (totalBatches < 1 || files.length < 1)
      //   throw new CustomError("Insufficient file count.", 400);
      // const slotAcquired = await acquireSlot(collectionId, totalBatches);
      // if (!slotAcquired)
      //   throw new CustomError(
      //     "The minting service is at maximum capacity. Please wait a moment and try again.",
      //     400
      //   );

      // const orderItemCount = await orderItemRepository.getCountByCollectionId(
      //   collectionId
      // );
      // const nftMetadatas: nftMetaData[] = [];
      // let index = 0;
      // for (let file of files) {
      //   let nftId = Number(orderItemCount) + index;

      //   nftMetadatas.push({
      //     name: `${collection.name} #${nftId}`,
      //     nftId: nftId.toString(),
      //     ipfsUri: null,
      //     file: file,
      //   });

      //   index++;
      // }

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

      if (collection.type === "IPFS") {
        await collectionRepository.update(db, collection.id, {
          contractAddress: transactionDetail.deployedContractAddress,
        });
      } else {
        if (!childCollection)
          throw new CustomError(
            "Child collection must be recorded for this operation.",
            400
          );

        await collectionRepository.update(db, childCollection.id, {
          contractAddress: transactionDetail.deployedContractAddress,
        });
      }
    }

    let networkFee = 0,
      mintFee = 0,
      serviceFee = 0;
    let funder = createFundingAddress("TESTNET");

    let txHex;
    //TODO: optimize fee calculation for both L1 & L2
    if (collection.type === "INSCRIPTION") {
      if (!totalFileSize || !totalCollectibleCount)
        throw new CustomError(
          "Please provide totalFileSize and totalCollectibleCount",
          400
        );

      networkFee =
        getEstimatedFee([10], [totalFileSize], 0, feeRate, 0).estimatedFee
          .totalAmount +
        (COMMIT_TX_SIZE + REVEAL_TX_SIZE) * totalCollectibleCount;
      mintFee = 0;
    } else if (collection.type === "RECURSIVE_INSCRIPTION") {
      if (!totalTraitCount || !totalFileSize)
        throw new CustomError(
          "Please provide an totalFileSize or totalTraitCount",
          400
        );

      networkFee =
        (totalTraitCount * BITCOIN_TXID_BYTE_SIZE + totalFileSize) * feeRate;
    } else if (collection.type === "IPFS") {
      funder = { address: config.VAULT_ADDRESS, privateKey: "", publicKey: "" };

      networkFee = 0;
      mintFee = Math.min(totalFileSize * feeRate, 0.00001);

      if (!collection.contractAddress) {
        throw new CustomError("Collection contractAddress not found.", 400);
      }
      txHex = launchPadService.generateFeeTransferTransaction(
        user.address,
        collection.contractAddress,
        funder.address
      );
    }
    let totalAmount = networkFee * 1.5 + mintFee + serviceFee;

    let order = await orderRepository.getByCollectionId(collection.id);
    if (order)
      throw new CustomError(
        "Mint order for this collection already exists.",
        400
      );

    order = await orderRepository.create(db, {
      userId: userId,
      fundingAmount: totalAmount,
      fundingAddress: funder.address,
      privateKey: funder.privateKey,
      orderType: "MINT_COLLECTIBLE",
      collectionId: collection.id,
      feeRate: feeRate,
      userLayerId,
    });

    // let orderItems, insertableOrderItems, nftUrls: any;

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

    // [nftUrls, insertableOrderItems] = await Promise.all([
    //   nftService.uploadNftImagesToIpfs(
    //     collection.name,
    //     files.length,
    //     files
    //   ),
    //   uploadToS3AndReturnOrderItems(order.id, nftMetadatas),
    // ]);

    // insertableOrderItems.forEach((metadata, index) => {
    //   metadata. = nftUrls[index];
    // });

    // orderItems = await orderItemRepository.bulkInsert(insertableOrderItems);

    // const isComplete = await updateProgress(collectionId);

    return { order, txHex };
  },
  invokeOrderForMinting: async (userId: string, id: string) => {
    const order = await orderRepository.getById(id);
    if (!order) throw new CustomError("Order not found.", 400);
    if (!order?.collectionId)
      throw new CustomError("Order does not have collectionId.", 400);
    if (order?.userId !== userId)
      throw new CustomError(
        "You are not allowed to create trait value for this collection.",
        400
      );

    const collection = await collectionRepository.getById(
      db,
      order.collectionId
    );
    if (!collection) throw new CustomError("No collection found.", 400);
    if (!order.fundingAddress)
      throw new CustomError("Invalid order with undefined address.", 400);

    const balance = await getBalance(order.fundingAddress);
    if (balance < order.fundingAmount)
      throw new CustomError("Fee has not been transferred yet.", 400);

    await orderItemRepository.updateByOrderId(order.id, { status: "IN_QUEUE" });
    const updatedOrder = await orderRepository.update(db, order.id, {
      orderStatus: "IN_QUEUE",
    });

    const orderItems: Insertable<OrderItem>[] = [];
    if (collection.type === "RECURSIVE_INSCRIPTION") {
      const traitValues = await traitValueRepository.getByCollectionId(
        collection.id
      );

      for (let i = 0; i < traitValues.length; i++)
        orderItems.push({
          orderId: order.id,
          traitValueId: traitValues[i].id,
          type: "TRAIT",
        });

      await orderItemRepository.bulkInsert(orderItems);
    }

    producer.sendMessage(order.id, 5);
    logger.info(`Enqueued ${order.id} to the SQS`);
    // if collection.type === 'RECURSIVE_INSCRIPTION', then invoke the trait minting first

    return { order: updatedOrder };
  },
  getByUserId: async (userId: string) => {
    const orders = await orderRepository.getByUserId(userId);
    return orders;
  },
  getById: async (orderId: string) => {
    const order = await orderRepository.getById(orderId);
    return order;
  },
};
