import { Order, OrderItem } from "@prisma/client";
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

export interface nftMetaData {
  nftId: string | null;
  name: string | null;
  file: Express.Multer.File | null;
  ipfsUri: string | null;
}

export const orderServices = {
  create: async (
    userId: string,
    orderType: ORDER_TYPE,
    feeRate: number,
    files: Express.Multer.File[],
    collectionId?: string
  ): Promise<{
    order: Order;
    orderItems: any[];
    batchMintTxHex: string | null;
  }> => {
    const user = await userRepository.getById(userId);
    if (!user) throw new Error("User not found.");
    const layerType = await layerRepository.getById(user.layerId!);
    if (!layerType) throw new Error("Layer not found.");

    let order: Order;
    let orderItems: any[];

    /*
      if user.layer is citrea
      create order & orderItems
      build metadata array with (nftId, ipfsUri)
      generate batch mint tx hex
      return that hex with the order & orderItems
    */

    let collection;
    if (orderType === "COLLECTION") {
      if (!collectionId) throw new Error("Collection id is required.");
      collection = await collectionServices.getById(collectionId);
      if (!collection) throw new Error("Collection not found.");
    }

    const nftMetadatas: nftMetaData[] = [];
    let index = 0;
    for (let file of files) {
      const nftId = layerType.layer === "CITREA" ? index.toString() : null;
      nftMetadatas.push({
        name: `${collection?.name ?? "NFT"} #${index}`,
        nftId: nftId,
        ipfsUri: null,
        file: file,
      });

      index++;
    }

    console.log(nftMetadatas);

    if (layerType.layer === "CITREA" && layerType.network === "TESTNET") {
      let networkFee = 0,
        serviceFee = 0;
      let totalAmount = networkFee + serviceFee;

      switch (orderType) {
        case ORDER_TYPE.COLLECTIBLE:
          if (files.length !== 1)
            throw new Error("Collectible order must have one file.");

          order = await orderRepository.create({
            userId: userId,
            quantity: files.length,
            fundingAddress: "",
            fundingAmount: totalAmount,
            networkFee: networkFee,
            serviceFee: serviceFee,
            privateKey: "",
            orderType: orderType,
            feeRate: feeRate,
          });

          orderItems = await uploadToS3AndCreateOrderItems(
            order.id,
            nftMetadatas
          );
          break;

        case ORDER_TYPE.COLLECTION:
          if (files.length < 1)
            throw new Error(
              "Collection order must have at least one collectible file."
            );
          if (!collection) throw new Error("Collection not found.");

          order = await orderRepository.create({
            userId: userId,
            quantity: files.length,
            fundingAddress: "",
            fundingAmount: totalAmount,
            networkFee: networkFee,
            serviceFee: serviceFee,
            privateKey: "",
            orderType: orderType,
            collectionId: collection.id,
            feeRate: feeRate,
          });
          orderItems = await uploadToS3AndCreateOrderItems(
            order.id,
            nftMetadatas
          );
          break;
        case ORDER_TYPE.LAUNCH:
          throw new Error("Launch order is not supported yet.");
          break;
        case ORDER_TYPE.TOKEN:
          throw new Error("Token order is not supported yet.");
        default:
          throw new Error("Invalid order type.");
      }

      for (const nftMetadata of nftMetadatas) {
        const ipfsUri = "DULGUUN";
        nftMetadata.ipfsUri = ipfsUri;
      }

      const batchMintTxHex = "DULGUUN";

      return { order, orderItems, batchMintTxHex };
    } else if (
      layerType.layer === "FRACTAL" &&
      layerType.network === "TESTNET"
    ) {
      let serviceFee = SERVICE_FEE[layerType.layer][layerType.network];
      const funder = createFundingAddress(layerType.layer, layerType.network);

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

      switch (orderType) {
        case ORDER_TYPE.COLLECTIBLE:
          if (files.length !== 1)
            throw new Error("Collectible order must have one file.");

          order = await orderRepository.create({
            userId: userId,
            quantity: files.length,
            fundingAddress: funder.address,
            fundingAmount: estimatedFee.totalAmount,
            networkFee: estimatedFee.networkFee,
            serviceFee: estimatedFee.serviceFee,
            privateKey: funder.privateKey,
            orderType: orderType,
            feeRate: feeRate,
          });

          orderItems = await uploadToS3AndCreateOrderItems(
            order.id,
            nftMetadatas
          );
          break;

        case ORDER_TYPE.COLLECTION:
          if (files.length < 1)
            throw new Error(
              "Collection order must have at least one collectible file."
            );
          if (!collection) throw new Error("Collection not found.");

          order = await orderRepository.create({
            userId: userId,
            quantity: files.length,
            fundingAddress: funder.address,
            fundingAmount: estimatedFee.totalAmount,
            networkFee: estimatedFee.networkFee,
            serviceFee: estimatedFee.serviceFee,
            privateKey: funder.privateKey,
            orderType: orderType,
            collectionId: collection.id,
            feeRate: feeRate,
          });
          orderItems = await uploadToS3AndCreateOrderItems(
            order.id,
            nftMetadatas
          );
          break;
        case ORDER_TYPE.LAUNCH:
          throw new Error("Launch order is not supported yet.");
          break;
        case ORDER_TYPE.TOKEN:
          throw new Error("Token order is not supported yet.");
        default:
          throw new Error("Invalid order type.");
      }

      return { order, orderItems, batchMintTxHex: null };
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
  checkOrderisPaid: async (orderId: string, txid?: string) => {
    // Check payment status
    // If payment is confirmed, return true else false
    try {
      const order = await orderRepository.getById(orderId);
      console.log(order);
      if (!order) throw new Error("Order not found.");
      if (order.paidAt) return true;

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

        const isValidTx = txid ? true : false;
        if (!isValidTx) throw new CustomError("Invalid tx.", 400);
        console.log(isValidTx);

        order.paidAt = new Date();
        await orderRepository.update(order.id, {
          paidAt: order.paidAt,
          orderStatus: "DONE",
        });

        const orderItems = await orderItemRepository.updateByOrderId(order.id, {
          status: "MINTED",
        });

        if (collection && collection.id) {
          console.log(collection);
          if (collection?.type === "UNCONFIRMED" && order.collectionId)
            await collectionRepository.update(order.collectionId, {
              type: "MINTED",
            });

          const collectibles: Insertable<Collectible>[] = [];
          for (const orderItem of orderItems) {
            if (collection?.id && orderItem.evmAssetId) {
              collectibles.push({
                collectionId: collection.id,
                uniqueIdx: orderItem.evmAssetId,
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
      });
    })
  );
}
