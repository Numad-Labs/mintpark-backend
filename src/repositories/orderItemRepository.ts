import { Insertable, Updateable } from "kysely";
import { db } from "../utils/db";
import { OrderItem } from "../types/db/types";
import { create } from "domain";
import { LAYER, NETWORK } from "../types/db/enums";

export interface OrderItemDetails {
  id: string;
  orderId: string;
  userId: string;
  userAddress: string;
  fileKey: string;
  ipfsUrl: string | null;
  metadata: unknown;
  status: "PENDING" | "IN_QUEUE" | "MINTING" | "MINTED" | "FAILED";
  layerId: string;
  network: "MAINNET" | "TESTNET";
  layer: "BITCOIN" | "FRACTAL" | "CITREA";
}

export const orderItemRepository = {
  create: async (data: Insertable<OrderItem>) => {
    const orderItem = await db
      .insertInto("OrderItem")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow(
        () => new Error("Couldnt create the order item.")
      );

    return orderItem;
  },
  update: async (id: string, data: Updateable<OrderItem>) => {
    const orderItem = await db
      .updateTable("OrderItem")
      .returningAll()
      .set(data)
      .where("OrderItem.id", "=", id)
      .executeTakeFirstOrThrow(
        () => new Error("Couldnt update the order item.")
      );

    return orderItem;
  },
  delete: async (id: string) => {
    const orderItem = await db
      .deleteFrom("OrderItem")
      .returningAll()
      .where("OrderItem.id", "=", id)
      .executeTakeFirstOrThrow(
        () => new Error("Couldnt delete the order item.")
      );

    return orderItem;
  },
  getById: async (id: string) => {
    const result = await db
      .selectFrom("Order")
      .innerJoin("OrderItem", "Order.id", "OrderItem.orderId")
      .innerJoin("User", "Order.userId", "User.id")
      // .innerJoin("Layer", "User.layerId", "Layer.id")
      .select([
        "OrderItem.id as id",
        "OrderItem.orderId as orderId",
        "User.id as userId",
        "OrderItem.fileKey",
        "OrderItem.metadata",
        "OrderItem.metadata",
        "OrderItem.ipfsUrl",
        "OrderItem.status",
        // "Layer.id as layerId",
        // "Layer.network",
        // "Layer.layer",
      ])
      .where("OrderItem.id", "=", id)
      .executeTakeFirst();

    return result || null;
  },
  getByOrderId: async (orderId: string) => {
    return await db
      .selectFrom("Order")
      .innerJoin("OrderItem", "Order.id", "OrderItem.orderId")
      .innerJoin("User", "Order.userId", "User.id")
      // .innerJoin("Layer", "User.layerId", "Layer.id")
      .select([
        "OrderItem.id as id",
        "OrderItem.orderId as orderId",
        "User.id as userId",
        "OrderItem.fileKey",
        "OrderItem.metadata",
        "OrderItem.status",
        "OrderItem.ipfsUrl",
        // "Layer.id as layerId",
        // "Layer.network",
        // "Layer.layer",
      ])
      .where("Order.id", "=", orderId)
      // .where("OrderItem.status", "=", "MINTED")
      .execute();
  },
  updateByOrderId: async (orderId: string, data: Updateable<OrderItem>) => {
    const orderItems = await db
      .updateTable("OrderItem")
      .set(data)
      .returningAll()
      .where("OrderItem.orderId", "=", orderId)
      .where("OrderItem.status", "!=", "MINTED")
      .execute();

    return orderItems;
  },
  getCountByCollectionId: async (collectionId: string) => {
    const result = await db
      .selectFrom("OrderItem")
      .innerJoin("Order", "Order.id", "OrderItem.orderId")
      .select((eb) => [eb.fn.countAll().$castTo<number>().as("count")])
      .where("Order.collectionId", "=", collectionId)
      .executeTakeFirst();

    return result?.count;
  },
  bulkInsert: async (data: Insertable<OrderItem>[]) => {
    const orderItems = await db
      .insertInto("OrderItem")
      .values(data)
      .returningAll()
      .execute();

    return orderItems;
  },
};
