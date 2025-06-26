import { Insertable, Kysely, Transaction, Updateable } from "kysely";
import { db } from "../utils/db";
import { DB, Order } from "../types/db/types";
import { LAYER, ORDER_STATUS, ORDER_TYPE } from "../types/db/enums";

export const orderRepository = {
  create: async (db: Kysely<DB> | Transaction<DB>, data: Insertable<Order>) => {
    const order = await db
      .insertInto("Order")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow(() => new Error("Couldnt create the order."));

    return order;
  },
  update: async (
    db: Kysely<DB> | Transaction<DB>,
    id: string,
    data: Updateable<Order>
  ) => {
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
  getById: async (db: Kysely<DB> | Transaction<DB>, id: string) => {
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
      .orderBy("Order.createdAt desc")
      .execute();

    return orders;
  },
  // getByUserAddress: async (userAddress: string) => {
  //   const orders = await db
  //     .selectFrom("Order")
  //     .selectAll()
  //     .innerJoin("User", "Order.userId", "User.id")
  //     .where("User.address", "=", userAddress)
  //     .execute();

  //   return orders;
  // },
  updateOrderStatus: async (id: string, status: ORDER_STATUS) => {
    const order = await db
      .updateTable("Order")
      .returningAll()
      .set({ orderStatus: status })
      .where("Order.id", "=", id)
      .executeTakeFirstOrThrow(
        () => new Error("Couldnt update the order status.")
      );

    return order;
  },
  getByCollectionId: async (collectionId: string) => {
    const order = await db
      .selectFrom("Order")
      .selectAll()
      .where("Order.collectionId", "=", collectionId)
      .where("Order.orderType", "=", "MINT_RECURSIVE_COLLECTIBLE")
      .orderBy("createdAt asc")
      .executeTakeFirst();

    return order;
  }
};
