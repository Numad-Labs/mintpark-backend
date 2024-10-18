import { sql } from "kysely";
import { db } from "../utils/db";

export const collectibleRepository = {
  getListableCollectiblesByInscriptionIds: async (inscriptionIds: string[]) => {
    const collectibles = await db
      .selectFrom("Collectible")
      .selectAll()
      .where("Collectible.uniqueIdx", "in", inscriptionIds)
      .execute();

    return collectibles;
  },
  getListableCollectiblesByCollectionId: async (collectionId: string) => {
    const collectibles = await db
      .with("FloorPrices", (db) =>
        db
          .selectFrom("List")
          .rightJoin("Collectible", "List.collectibleId", "Collectible.id")
          .select((eb) => [
            "Collectible.collectionId",
            eb.fn
              .coalesce(sql<number>`MIN("List"."price")`, sql<number>`0`)
              .as("floor"),
          ])
          .groupBy("Collectible.collectionId")
      )
      .selectFrom("Collectible")
      .innerJoin("Collection", "Collection.id", "Collectible.collectionId")
      .leftJoin("List", "List.collectibleId", "Collectible.id")
      .leftJoin(
        "FloorPrices",
        "FloorPrices.collectionId",
        "Collectible.collectionId"
      )
      .select(({ eb }) => [
        "Collectible.id",
        "Collectible.name",
        "Collectible.uniqueIdx",
        "Collectible.createdAt",
        "Collectible.fileKey",
        "Collectible.collectionId",
        "Collection.name as collectionName",
        eb.fn.coalesce("List.price", sql<number>`0`).as("price"),
        "FloorPrices.floor",
        sql<number>`"price" / "FloorPrices"."floor"`
          .$castTo<number>()
          .as("floorDifference"),
      ])
      .where("Collectible.collectionId", "=", collectionId)
      .execute();

    return collectibles;
  },
  getByIdWithDetails: async (id: string) => {
    const collectibles = await db
      .with("FloorPrices", (db) =>
        db
          .selectFrom("List")
          .rightJoin("Collectible", "List.collectibleId", "Collectible.id")
          .select((eb) => [
            "Collectible.collectionId",
            eb.fn
              .coalesce(sql<number>`MIN("List"."price")`, sql<number>`0`)
              .as("floor"),
          ])
          .groupBy("Collectible.collectionId")
      )
      .selectFrom("Collectible")
      .innerJoin("Collection", "Collection.id", "Collectible.collectionId")
      .leftJoin("List", "List.collectibleId", "Collectible.id")
      .leftJoin(
        "FloorPrices",
        "FloorPrices.collectionId",
        "Collectible.collectionId"
      )
      .select(({ eb }) => [
        "Collectible.id",
        "Collectible.name",
        "Collectible.uniqueIdx",
        "Collectible.createdAt",
        "Collectible.fileKey",
        "Collectible.collectionId",
        "Collection.description",
        "Collection.name as collectionName",
        eb.fn.coalesce("List.price", sql<number>`0`).as("price"),
        "FloorPrices.floor",
        sql<number>`"price" / "FloorPrices"."floor"`
          .$castTo<number>()
          .as("floorDifference"),
      ])
      .where("Collectible.id", "=", id)
      .execute();

    return collectibles;
  },
};
