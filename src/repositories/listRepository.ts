import { Insertable, sql, Updateable } from "kysely";
import { db } from "../utils/db";
import { List } from "../types/db/types";

export const listRepository = {
  create: async (data: Insertable<List>) => {
    const list = await db
      .insertInto("List")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow(
        () => new Error("Could not create the listing.")
      );

    return list;
  },
  confirmByCollectibleId: async (collectibleId: string) => {
    const list = await db
      .updateTable("List")
      .set({ status: "ACTIVE" })
      .returningAll()
      .executeTakeFirstOrThrow(() => new Error("Could not confirm the list."));

    return list;
  },
  cancelPendingListingsByCollectibleId: async (collectibleId: string) => {
    const listings = await db
      .updateTable("List")
      .returningAll()
      .set({ status: "CANCELLED" })
      .where("List.collectibleId", "=", collectibleId)
      .where("List.status", "=", "PENDING")
      .execute();

    return listings;
  },
  getLatestPendingListByCollectibleId: async (collectibleId: string) => {
    const list = await db
      .selectFrom("List")
      .selectAll()
      .where("List.collectibleId", "=", collectibleId)
      .where("List.status", "=", "PENDING")
      .orderBy("List.listedAt desc")
      .executeTakeFirst();

    return list;
  },
  getById: async (id: string) => {
    const list = await db
      .selectFrom("List")
      .innerJoin("Collectible", "Collectible.id", "List.collectibleId")
      .innerJoin("Collection", "Collection.id", "Collectible.collectionId")
      .innerJoin("Layer", "Layer.id", "Collection.layerId")
      .select([
        "List.id",
        "List.address",
        "List.buyerId",
        "List.collectibleId",
        "List.inscribedAmount",
        "List.listedAt",
        "List.price",
        "List.privateKey",
        "List.soldAt",
        "List.soldTxid",
        "List.vaultTxid",
        "List.vaultVout",
        "List.status",
        "List.sellerId",
        "Layer.layer",
        "Layer.network",
        "Collectible.uniqueIdx",
      ])
      .where("List.id", "=", id)
      .executeTakeFirst();

    return list;
  },
  update: async (id: string, data: Updateable<List>) => {
    const list = db
      .updateTable("List")
      .set(data)
      .returningAll()
      .where("List.id", "=", id)
      .executeTakeFirstOrThrow(() => new Error("Could not update the list."));

    return list;
  },
  getActiveListCountByCollectionid: async (collectionId: string) => {
    const result = await db
      .selectFrom("List")
      .innerJoin("Collectible", "Collectible.id", "List.collectibleId")
      .select((eb) => [
        eb.fn
          .coalesce(eb.fn.count("List.id").$castTo<number>(), sql<number>`0`)
          .as("activeListCount"),
      ])
      .where("Collectible.collectionId", "=", collectionId)
      .where("List.status", "=", "ACTIVE")
      .executeTakeFirst();

    return result;
  },
  getActiveListCountByUserId: async (userId: string) => {
    const result = await db
      .selectFrom("List")
      .select((eb) => [
        eb.fn
          .coalesce(eb.fn.count("List.id").$castTo<number>(), sql<number>`0`)
          .as("activeListCount"),
      ])
      .where("List.sellerId", "=", userId)
      .where("List.status", "=", "ACTIVE")
      .executeTakeFirst();

    return result;
  },
};
