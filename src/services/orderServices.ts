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

export const orderServices = {
  create: async (
    userId: string,
    orderType: ORDER_TYPE,
    files: Express.Multer.File[],
    collectionId?: string
  ): Promise<{ order: Order; orderItems: any[] }> => {
    const user = await userRepository.getById(userId);
    if (!user) throw new Error("User not found.");

    const layerType = await layerRepository.getById(user.layerId!);
    if (!layerType) throw new Error("Layer not found.");

    let order: Order;
    let orderItems: any[];
    let fundingAmount = 2000; //Calculate fee
    const funder = createFundingAddress(layerType.layer, layerType.network);

    switch (orderType) {
      case ORDER_TYPE.COLLECTIBLE:
        if (files.length !== 1)
          throw new Error("Collectible order must have one file.");
        order = await orderRepository.create({
          userId: userId,
          quantity: files.length,
          fundingAddress: funder.address,
          fundingAmount: fundingAmount,
          networkFee: fundingAmount - SERVICE_FEE,
          serviceFee: SERVICE_FEE,
          privateKey: funder.privateKey,
          orderType: orderType,
        });
        orderItems = await createOrderItems(order.id, files);
        break;

      case ORDER_TYPE.COLLECTION:
        if (files.length < 1)
          throw new Error(
            "Collection order must have at least one logo and one collectible file."
          );
        if (!collectionId) throw new Error("Collection id is required.");
        const collection = await collectionServices.getById(collectionId);
        if (!collection) throw new Error("Collection not found.");

        order = await orderRepository.create({
          userId: userId,
          quantity: files.length,
          fundingAddress: funder.address,
          fundingAmount: fundingAmount * files.length,
          networkFee: fundingAmount * files.length - SERVICE_FEE * files.length,
          serviceFee: SERVICE_FEE * files.length,
          privateKey: funder.privateKey,
          orderType: orderType,
          collectionId: collection.id,
        });
        orderItems = await createOrderItems(order.id, files);

        collection.supply += files.length;
        await collectionServices.update(collection.id, {
          supply: collection.supply,
        });
        break;

      case ORDER_TYPE.TOKEN:
        throw new Error("Token order is not supported yet.");
      case ORDER_TYPE.LAUNCH:
        throw new Error("Launch order is not supported yet.");
      default:
        throw new Error("Invalid order type.");
    }

    return { order, orderItems };
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

async function createOrderItems(
  orderId: string,
  files: Express.Multer.File[]
): Promise<any[]> {
  return await Promise.all(
    files.map(async (file) => {
      const key = randomUUID();
      await uploadToS3(key, file);
      return await orderItemRepository.create({
        orderId,
        fileKey: key,
      });
    })
  );
}
