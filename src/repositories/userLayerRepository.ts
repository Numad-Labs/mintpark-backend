import { Insertable } from "kysely";
import { db } from "../utils/db";
import { UserLayer } from "../types/db/types";

export const userLayerRepository = {
  create: async (data: Insertable<UserLayer>) => {
    const userLayer = await db
      .insertInto("UserLayer")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow(
        () => new Error("Could not create the userLayer.")
      );

    return userLayer;
  },
  deactivateById: async (id: string) => {
    const userLayer = await db
      .updateTable("UserLayer")
      .set({ isActive: false, deactivatedAt: new Date().toISOString() })
      .returningAll()
      .where("UserLayer.id", "=", id)
      .executeTakeFirstOrThrow(
        () => new Error("Could not update the userLayer.")
      );

    return userLayer;
  },
  // updateUserIdById: async (id: string, userId: string) => {
  //   const userLayer = await db
  //     .updateTable("UserLayer")
  //     .set({ userId })
  //     .returningAll()
  //     .where("UserLayer.id", "=", id)
  //     .executeTakeFirstOrThrow(
  //       () => new Error("Could not update the userLayer.")
  //     );

  //   return userLayer;
  // },
  getByAddressAndLayerId: async (address: string, layerId: string) => {
    const userLayer = await db
      .selectFrom("UserLayer")
      .selectAll()
      .where("UserLayer.address", "=", address)
      .where("UserLayer.layerId", "=", layerId)
      .where("UserLayer.isActive", "=", true)
      .executeTakeFirst();

    return userLayer;
  },
  getActiveAddressesByUserIdAndLayerId: async (
    userId: string,
    layerId: string
  ) => {
    const userLayer = await db
      .selectFrom("UserLayer")
      .select(["address"])
      .where("UserLayer.isActive", "=", true)
      .where("UserLayer.userId", "=", userId)
      .where("UserLayer.layerId", "=", layerId)
      .execute();

    return userLayer;
  }
};
