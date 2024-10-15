import { Insertable, Updateable } from "kysely";
import { db } from "../utils/db";
import { Order } from "../types/db/types";

export const orderRepository = {
  create: async (data: Insertable<Order>) => {
    const order = await db
      .insertInto("Order")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow(() => new Error("Couldnt create the order."));

    return order;
  },
  update: async (id: string, data: Updateable<Order>) => {
    const order = await db
      .updateTable("Order")
      .returningAll()
      .set(data)
      .where("Order.id", "=", id)
      .executeTakeFirstOrThrow(() => new Error("Couldnt update the order."));

    return order;
  },
  delete: async (id: string) => {
    const order = await db
      .deleteFrom("Order")
      .returningAll()
      .where("Order.id", "=", id)
      .executeTakeFirstOrThrow(() => new Error("Couldnt delete the order."));

    return order;
  },
  getById: async (id: string) => {
    const order = await db
      .selectFrom("Order")
      .selectAll()
      .where("Order.id", "=", id)
      .executeTakeFirst();

    return order;
  },
  getByUserId: async (userId: string) => {
    const orders = await db
      .selectFrom("Order")
      .selectAll()
      .where("Order.userId", "=", userId)
      .execute();

    return orders;
  },
  getByUserAddress: async (userAddress: string) => {
    const orders = await db
      .selectFrom("Order")
      .selectAll()
      .innerJoin("User", "Order.userId", "User.id")
      .where("User.address", "=", userAddress)
      .execute();

    return orders;
  },
};
