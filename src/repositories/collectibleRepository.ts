import { Insertable, sql } from "kysely";
import { db } from "../utils/db";
import { Collectible } from "../types/db/types";
import {
  CollectibleQueryParams,
  traitFilter,
} from "../controllers/collectibleController";

export const collectibleRepository = {
  create: async (data: Insertable<Collectible>) => {
    const collectible = await db
      .insertInto("Collectible")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow(
        () => new Error("Couldnt create the collectible.")
      );

    return collectible;
  },
  getById: async (id: string) => {
    const collectible = await db
      .selectFrom("Collectible")
      .innerJoin("Collection", "Collection.id", "Collectible.collectionId")
      .innerJoin("Layer", "Layer.id", "Collection.layerId")
      .select([
        "Collectible.id",
        "Collectible.name",
        "Collectible.uniqueIdx",
        "Collectible.createdAt",
        "Collectible.fileKey",
        "Collectible.collectionId",
        "Layer.layer",
        "Layer.network",
      ])
      .where("Collectible.id", "=", id)
      .executeTakeFirst();

    return collectible;
  },
  getListableCollectiblesByInscriptionIds: async (
    inscriptionIds: string[],
    params: CollectibleQueryParams,
    userId: string
  ) => {
    let query = db
      .selectFrom("Collectible")
      .leftJoin("List as CurrentList", (join) =>
        join
          .onRef("CurrentList.collectibleId", "=", "Collectible.id")
          .on("CurrentList.status", "=", "ACTIVE")
      )
      .innerJoin("Collection", "Collection.id", "Collectible.collectionId")
      .select(({ eb }) => [
        "Collectible.id",
        "Collectible.name",
        "Collectible.uniqueIdx",
        "Collectible.createdAt",
        "Collectible.fileKey",
        "Collectible.createdAt",
        "Collectible.collectionId",
        "Collection.name as collectionName",
        "CurrentList.listedAt",
        "CurrentList.id as listId",
        "CurrentList.price",
        eb.fn
          .coalesce(
            eb
              .selectFrom("List")
              .innerJoin("Collectible", "Collectible.id", "List.collectibleId")
              .select("price")
              .where("Collectible.collectionId", "=", eb.ref("Collection.id"))
              .orderBy("price", "asc")
              .limit(1),
            sql<number>`0`
          )
          .as("floor"),
      ])
      .where((eb) =>
        eb("Collectible.uniqueIdx", "in", inscriptionIds).or(
          eb("CurrentList.price", ">", 0).and(
            "CurrentList.sellerId",
            "=",
            userId
          )
        )
      );

    if (params.isListed)
      query = query.where("CurrentList.status", "=", "ACTIVE");

    const collectionIds = params.collectionIds as string[];
    if (collectionIds && collectionIds.length > 0) {
      query = query.where((eb) =>
        eb.or(
          collectionIds.map((collectionId) =>
            eb("Collectible.collectionId", "=", collectionId)
          )
        )
      );
    }

    switch (params.orderBy) {
      case "price":
        query = query.orderBy(
          "CurrentList.price",
          params.orderDirection === "desc" ? "desc" : "asc"
        );
        break;
      case "recent":
        query = query.orderBy("CurrentList.listedAt", "asc");
        break;
      default:
        query = query.orderBy("Collectible.createdAt", "asc");
    }

    const collectibles = await query.execute();

    return collectibles;
  },
  getListableCollectiblesCountByInscriptionIds: async (
    inscriptionIds: string[]
  ) => {
    const result = await db
      .selectFrom("Collectible")
      .select((eb) => [
        eb.fn.count<number>("Collectible.id").$castTo<number>().as("count"),
      ])
      .where("Collectible.uniqueIdx", "in", inscriptionIds)
      .executeTakeFirst();

    return result;
  },
  getListableCollectiblesByCollectionId: async (
    collectionId: string,
    params: CollectibleQueryParams,
    traitsFilters: traitFilter[]
  ) => {
    let query = db
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
          .where("List.price", ">", 0)
          .groupBy("Collectible.collectionId")
      )
      .selectFrom("Collectible")
      .innerJoin("Collection", "Collection.id", "Collectible.collectionId")
      .leftJoin("List as CurrentList", (join) =>
        join
          .onRef("CurrentList.collectibleId", "=", "Collectible.id")
          .on("CurrentList.status", "=", "ACTIVE")
      )
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
        eb.fn.coalesce("CurrentList.price", sql<number>`0`).as("price"),
        "FloorPrices.floor",
        sql`
          CASE 
            WHEN ${eb.ref("FloorPrices.floor")} > 0 
            THEN ${eb.ref("CurrentList.price")} / ${eb.ref("FloorPrices.floor")}
            ELSE 0 
          END`
          .$castTo<number>()
          .as("floorDifference"),
        "CurrentList.address as ownedBy",
        "CurrentList.listedAt",
        "CurrentList.id as listId",
      ])
      .where("Collectible.collectionId", "=", collectionId);

    if (params.isListed)
      query = query.where("CurrentList.status", "=", "ACTIVE");

    if (traitsFilters.length > 0) {
      query = query.where((eb) =>
        eb.exists(
          eb
            .selectFrom("CollectibleTrait")
            .innerJoin("Trait", "Trait.id", "CollectibleTrait.traitId")
            .whereRef("CollectibleTrait.collectibleId", "=", "Collectible.id")
            .where((eb) =>
              eb.or(
                traitsFilters.map((traitFilter) =>
                  eb.and([
                    sql`lower(${eb.ref("Trait.name")}) = lower(${
                      traitFilter.name
                    })`.$castTo<boolean>(),
                    sql`lower(${eb.ref("CollectibleTrait.value")}) = lower(${
                      traitFilter.value
                    })`.$castTo<boolean>(),
                  ])
                )
              )
            )
        )
      );
    }

    switch (params.orderBy) {
      case "price":
        query = query.orderBy(
          "CurrentList.price",
          params.orderDirection === "desc" ? "desc" : "asc"
        );
        break;
      case "recent":
        query = query.orderBy("CurrentList.listedAt", "asc");
        break;
      default:
        query = query.orderBy("Collectible.createdAt", "asc");
    }

    const collectibles = await query.execute();

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
          .where("List.price", ">", 0)
          .groupBy("Collectible.collectionId")
      )
      .selectFrom("Collectible")
      .innerJoin("Collection", "Collection.id", "Collectible.collectionId")
      .leftJoin("List as CurrentList", (join) =>
        join
          .onRef("CurrentList.collectibleId", "=", "Collectible.id")
          .on("CurrentList.status", "=", "ACTIVE")
      )
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
        eb.fn.coalesce("CurrentList.price", sql<number>`0`).as("price"),
        "FloorPrices.floor",
        sql`
          CASE 
            WHEN ${eb.ref("FloorPrices.floor")} > 0 
            THEN ${eb.ref("CurrentList.price")} / ${eb.ref("FloorPrices.floor")}
            ELSE 0 
          END`
          .$castTo<number>()
          .as("floorDifference"),
        "CurrentList.address as ownedBy",
        "CurrentList.listedAt",
        "CurrentList.id as listId",
      ])
      .where("Collectible.id", "=", id)
      .execute();

    return collectibles;
  },
  getListableCollectiblesCountByCollectionId: async (collectionId: string) => {
    const countResult = await db
      .selectFrom("Collectible")
      .innerJoin("Collection", "Collection.id", "Collectible.collectionId")
      .select(({ eb }) => [
        eb.fn
          .coalesce(
            eb.fn.count("Collectible.id").$castTo<number>(),
            sql<number>`0`
          )
          .as("collectibleCount"),
      ])
      .where("Collectible.collectionId", "=", collectionId)
      .execute();

    return countResult;
  },
  getByUniqueIdx: async (uniqueIdx: string) => {
    const collectible = await db
      .selectFrom("Collectible")
      .innerJoin("Collection", "Collection.id", "Collectible.collectionId")
      .innerJoin("Layer", "Layer.id", "Collection.layerId")
      .select([
        "Collectible.id",
        "Collectible.name",
        "Collectible.uniqueIdx",
        "Collectible.createdAt",
        "Collectible.fileKey",
        "Collectible.collectionId",
        "Layer.layer",
        "Layer.network",
      ])
      .where("Collectible.uniqueIdx", "=", uniqueIdx)
      .executeTakeFirst();

    return collectible;
  },
  bulkInsert: async (data: Insertable<Collectible>[]) => {
    const collectibles = await db
      .insertInto("Collectible")
      .values(data)
      .returningAll()
      .execute();

    return collectibles;
  },
};
