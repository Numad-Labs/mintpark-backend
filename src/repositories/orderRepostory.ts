import { Insertable, Updateable } from "kysely";
import { db } from "../utils/db";
import { Order } from "../types/db/types";
import { LAYER, ORDER_STATUS, ORDER_TYPE } from "../types/db/enums";

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
      .orderBy("Order.createdAt desc")
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
  getAll: async (layer: LAYER) => {
    const orders = await db
      .selectFrom("Order")
      .innerJoin("User", "User.id", "Order.userId")
      .innerJoin("Layer", "Layer.id", "User.layerId")
      .selectAll(["Order"])
      .where("Order.orderStatus", "!=", "DONE")
      .where("Order.orderStatus", "!=", "EXPIRED")
      .where("Layer.layer", "=", layer)
      .execute();

    return orders;
  },
  getInQueueOrders: async (layer: LAYER) => {
    const orders = await db
      .selectFrom("Order")
      .selectAll()
      .where("Order.orderStatus", "=", ORDER_STATUS.IN_QUEUE)
      .where("Order.orderType", "!=", ORDER_TYPE.LAUNCH) //TODO. Make it for launch too
      .execute();

    return orders;
  },
  getByCollectionId: async (collectionId: string) => {
    const order = await db
      .selectFrom("Order")
      .selectAll()
      .where("Order.collectionId", "=", collectionId)
      .orderBy("createdAt desc")
      .executeTakeFirst();

    return order;
  },
};
