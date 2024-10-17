import { Insertable, Updateable } from "kysely";
import { db } from "../utils/db";
import { OrderItem } from "../types/db/types";
import { create } from "domain";

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
    const orderItem = await db
      .selectFrom("OrderItem")
      .selectAll()
      .where("OrderItem.id", "=", id)
      .executeTakeFirst();

    return orderItem;
  },
  getByOrderId: async (orderId: string) => {
    const orderItems = await db
      .selectFrom("OrderItem")
      .selectAll()
      .where("OrderItem.orderId", "=", orderId)
      .execute();

    return orderItems;
  },
};
