import { Insertable, Kysely, sql, Updateable } from "kysely";
import { Order } from "../types/db/types";
import { db } from "../utils/db";
import { LAYER_TYPE } from "../types/db/enums";
import { address } from "chromajs-lib";

export const orderRepository = {
  create: async (data: Insertable<Order>) => {
    const order = await db
      .insertInto("Order")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow(() => new Error("Could not create the order."));
    return order;
  },
  getById: async (orderId: string) => {
    const order = await db
      .selectFrom("Order")
      .selectAll()
      .where("Order.orderId", "=", orderId)
      .executeTakeFirst();
    return order;
  },
  getByCollectionId: async (orderId: string) => {
    const order = await db
      .selectFrom("Order")
      .selectAll()
      .where("Order.collectionId", "=", orderId)
      .executeTakeFirst();
    return order;
  },
  getUserLastOrderByAddress: async (
    address: string,
    layer_type: LAYER_TYPE
  ) => {
    const order = await db
      .selectFrom("Order")
      .selectAll()
      .where("Order.userAddress", "=", address)
      .where("Order.status", "=", "PENDING")
      .where("Order.layerType", "=", layer_type)
      .orderBy("Order.createdAt desc")
      .executeTakeFirst();
    return order;
  },
  updateOrderStatus: async (orderId: string, txId: string) => {
    const order = await db
      .updateTable("Order")
      .set({ status: "INSCRIBED", generatedPsbtTxId: txId })
      .where("orderId", "=", orderId)
      .returningAll()
      .executeTakeFirstOrThrow(
        () => new Error("Could not update the order status.")
      );
    return order;
  },
  updateExpiredOrderStatus: async (cutoffDate: Date) => {
    try {
      const orders = await db
        .updateTable("Order")
        .set({ status: "CLOSED", updatedAt: sql`NOW()` })
        .where("createdAt", "<", cutoffDate)
        .where("status", "=", "PENDING")
        .returningAll()
        .execute();
      return orders;
    } catch (error) {
      console.error("Error updating expired orders:", error);
      throw error;
    }
  },
  getUserOrdersByLayerType: async (address: string, layerType: LAYER_TYPE) => {
    const orders = await db
      .selectFrom("Order")
      .select([
        "Order.orderId",
        "Order.status",
        "Order.createdAt",
        "Order.layerType",
        "Order.quantity",
        "Order.createdAt",
        // sql<number>`EXTRACT(DAY FROM (CURRENT_DATE - Order.created_at))`.as(
        //   "days_ago"
        // ),
      ])
      .where("Order.userAddress", "=", address)
      .where("Order.layerType", "=", layerType)
      .execute();
    return orders;
  },
  getPendingUserOrdersByLayerType: async (
    address: string,
    layerType: LAYER_TYPE
  ) => {
    const orders = await db
      .selectFrom("Order")
      .selectAll()
      .where("Order.userAddress", "=", address)
      .where("Order.layerType", "=", layerType)
      .where("Order.status", "=", "PENDING")
      .execute();
    return orders;
  },
};
