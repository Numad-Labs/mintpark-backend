import { Insertable, Kysely, sql, Transaction, Updateable } from "kysely";
import { db } from "../utils/db";
import { DB, List } from "../types/db/types";
import layerRouter from "@routes/layerRoutes";
import { LAYER, LIST_STATUS, NETWORK } from "@app-types/db/enums";

export const listRepository = {
  create: async (db: Kysely<DB> | Transaction<DB>, data: Insertable<List>) => {
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
  cancelListingsById: async (db: Kysely<DB> | Transaction<DB>, id: string) => {
    const listings = await db
      .updateTable("List")
      .returningAll()
      .set({ status: "CANCELLED" })
      .where("List.id", "=", id)
      .execute();

    return listings;
  },
  getLatestPendingListByCollectibleId: async (
    db: Kysely<DB> | Transaction<DB>,
    collectibleId: string
  ) => {
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
        "List.onchainListingId",
        "List.soldAt",
        "List.soldTxid",
        "List.vaultTxid",
        "List.vaultVout",
        "List.status",
        "List.sellerId",
        "Layer.layer",
        "Layer.network",
        "Layer.chainId",
        "Layer.layerType",
        "Collectible.uniqueIdx"
      ])
      .where("List.id", "=", id)
      .executeTakeFirst();

    return list;
  },

  getByCollectibleId: async (id: string) => {
    const list = await db
      .selectFrom("List")
      .innerJoin("Collectible", "Collectible.id", "List.collectibleId")
      // .innerJoin('List', "List.collectibleId")
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
        "Collectible.uniqueIdx"
      ])
      .where("Collectible.id", "=", id)
      .executeTakeFirst();

    return list;
  },
  update: async (
    db: Kysely<DB> | Transaction<DB>,
    id: string,
    data: Updateable<List>
  ) => {
    const list = db
      .updateTable("List")
      .set(data)
      .returningAll()
      .where("List.id", "=", id)
      .executeTakeFirstOrThrow(() => new Error("Could not update the list."));

    return list;
  },
  getActiveListCountByCollectionId: async (collectionId: string) => {
    const result = await db
      .selectFrom("List")
      .innerJoin("Collectible", "Collectible.id", "List.collectibleId")
      .select((eb) => [
        eb.fn
          .coalesce(eb.fn.count("List.id").$castTo<number>(), sql<number>`0`)
          .as("activeListCount")
      ])
      .where("Collectible.collectionId", "=", collectionId)
      .where("Collectible.status", "=", "CONFIRMED")
      .where("List.status", "=", "ACTIVE")
      .executeTakeFirst();

    return result;
  },
  getActiveListCountByAddressAndLayerId: async (
    address: string,
    layerId: string
  ) => {
    const result = await db
      .selectFrom("List")
      .innerJoin("Collectible", "Collectible.id", "List.collectibleId")
      .innerJoin("Collection", "Collection.id", "Collectible.collectionId")
      .select((eb) => [
        eb.fn
          .coalesce(eb.fn.count("List.id").$castTo<number>(), sql<number>`0`)
          .as("activeListCount")
      ])
      .where("List.status", "=", "ACTIVE")
      .where("List.sellerId", "in", (qb) =>
        qb
          .selectFrom("UserLayer")
          .select("UserLayer.userId")
          .where("UserLayer.address", "=", address)
          // .where("UserLayer.isActive", "=", true)
          .where("UserLayer.layerId", "=", layerId)
      )
      .where("Collection.layerId", "=", layerId)
      .executeTakeFirst();

    const hehe = await db
      .selectFrom("List")
      .select((eb) => ["List.id"])
      .where("List.status", "=", "ACTIVE")
      .where("List.sellerId", "in", (qb) =>
        qb
          .selectFrom("UserLayer")
          .select("UserLayer.userId")
          .where("UserLayer.address", "=", address)
          .where("UserLayer.isActive", "=", true)
      )
      .execute();

    return result;
  },
  updateListingStatus: async (
    db: Kysely<DB> | Transaction<DB>,
    id: string,
    status: LIST_STATUS, // Use the enum type instead of string literals
    updateData: Partial<Updateable<List>> = {}
  ) => {
    const updatedListing = await db
      .updateTable("List")
      .set({
        status: status as LIST_STATUS, // Now this should match the expected type
        ...updateData
      })
      .where("List.id", "=", id)
      .returningAll()
      .executeTakeFirst();

    return updatedListing;
  },
  getListingWithChainInfo: async (
    db: Kysely<DB> | Transaction<DB>,
    listingId: string
  ) => {
    const listing = await db
      .selectFrom("List")
      .innerJoin("Collectible", "Collectible.id", "List.collectibleId")
      .innerJoin("Collection", "Collection.id", "Collectible.collectionId")
      .innerJoin("Layer", "Layer.id", "Collection.layerId")
      .select([
        "List.id",
        "List.status as dbStatus",
        "List.privateKey",
        "List.vaultTxid",
        "Layer.layer",
        "Layer.chainId",
        "List.collectibleId",
        "List.sellerId",
        "List.buyerId",
        "List.soldAt",
        "List.soldTxid"
      ])
      .where("List.id", "=", listingId)
      .executeTakeFirst();

    return listing;
  },

  getActiveListingsByChain: async (
    db: Kysely<DB> | Transaction<DB>,
    layer: (typeof LAYER)[keyof typeof LAYER],
    network: (typeof NETWORK)[keyof typeof NETWORK],
    chainId: number
  ) => {
    const listings = await db
      .selectFrom("List")
      .innerJoin("Collectible", "Collectible.id", "List.collectibleId")
      .innerJoin("Collection", "Collection.id", "Collectible.collectionId")
      .innerJoin("Layer", "Layer.id", "Collection.layerId")
      .select([
        "List.id",
        "List.status",
        "List.vaultTxid",
        "List.privateKey",
        "List.listedAt",
        "Collectible.nftId",
        "Collection.contractAddress",
        "List.onchainListingId",
        "List.collectibleId"
      ])
      .where("Layer.layer", "=", layer)
      .where("Layer.network", "=", network)
      .where("Layer.chainId", "=", String(chainId))
      .where((eb) =>
        eb.or([
          eb("List.status", "=", LIST_STATUS.ACTIVE),
          eb("List.status", "=", LIST_STATUS.PENDING)
        ])
      )
      .execute();

    return listings;
  }
};
