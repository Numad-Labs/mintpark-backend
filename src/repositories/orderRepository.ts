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
      .where("Order.order_id", "=", orderId)
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
      .where("Order.user_address", "=", address)
      .where("Order.status", "=", "PENDING")
      .where("Order.layer_type", "=", layer_type)
      .orderBy("Order.created_at desc")
      .executeTakeFirst();
    return order;
  },
  updateOrderStatus: async (orderId: string, txId: string) => {
    const order = await db
      .updateTable("Order")
      .set({ status: "INSCRIBED", txid: txId })
      .where("order_id", "=", orderId)
      .returningAll()
      .executeTakeFirstOrThrow(
        () => new Error("Could not update the order status.")
      );
    return order;
  },
  updateExpiredOrderStatus: async (date: Date) => {
    const currentDate = new Date();
    if (currentDate.getMinutes() - date.getMinutes() >= 5) {
      const orders = await db
        .updateTable("Order")
        .set({ status: "CLOSED", updated_at: sql`NOW()` })
        .where("created_at", "<", date)
        .where("status", "=", "PENDING")
        .returningAll()
        .execute();
      return orders;
    }
  },
  getUserOrdersByLayerType: async (address: string, layerType: LAYER_TYPE) => {
    const orders = await db
      .selectFrom("Order")
      .select([
        "Order.order_id",
        "Order.status",
        "Order.created_at",
        "Order.layer_type",
        "Order.quantity",
        "Order.created_at",
        // sql<number>`EXTRACT(DAY FROM (CURRENT_DATE - Order.created_at))`.as(
        //   "days_ago"
        // ),
      ])
      .where("Order.user_address", "=", address)
      .where("Order.layer_type", "=", layerType)
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
      .where("Order.user_address", "=", address)
      .where("Order.layer_type", "=", layerType)
      .where("Order.status", "=", "PENDING")
      .execute();
    return orders;
  },
};
