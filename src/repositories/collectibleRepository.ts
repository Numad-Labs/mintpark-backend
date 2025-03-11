import { Insertable, Kysely, sql, Transaction, Updateable } from "kysely";
import { db } from "../utils/db";
import { Collectible, DB } from "../types/db/types";
import {
  CollectibleQueryParams,
  traitFilter
} from "../controllers/collectibleController";
import logger from "../config/winston";
import { log } from "console";
import { to_tsquery, to_tsvector } from "../libs/queryHelper";

export const collectibleRepository = {
  create: async (
    db: Kysely<DB> | Transaction<DB>,
    data: Insertable<Collectible>
  ) => {
    const collectible = await db
      .insertInto("Collectible")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow(
        () => new Error("Couldnt create the collectible.")
      );

    return collectible;
  },
  update: async (
    db: Kysely<DB> | Transaction<DB>,
    id: string,
    data: Updateable<Collectible>
  ) => {
    const collectible = await db
      .updateTable("Collectible")
      .set(data)
      .returningAll()
      .where("Collectible.id", "=", id)
      .executeTakeFirstOrThrow(
        () => new Error("Could not update the collectible.")
      );

    return collectible;
  },
  getById: async (db: Kysely<DB> | Transaction<DB>, id: string) => {
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
        "Collectible.cid",
        "Collectible.metadata",
        "Collectible.status",
        "Collectible.parentCollectibleId",
        "Collectible.mintingTxId",
        "Collectible.nftId",
        "Collectible.highResolutionImageUrl",
        "Layer.id as layerId",
        "Layer.layer",
        "Layer.network",
        "Layer.chainId",
        "Layer.layerType"
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
    const cleanInscriptionIds = Array.isArray(inscriptionIds)
      ? inscriptionIds.map((id) => id.toString())
      : [];

    if (cleanInscriptionIds.length === 0) {
      return [];
    }

    try {
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
          "Collectible.highResolutionImageUrl",
          "Collectible.collectionId",
          "Collection.name as collectionName",
          "CurrentList.listedAt",
          "CurrentList.id as listId",
          "CurrentList.price",
          eb.fn
            .coalesce(
              eb
                .selectFrom("List")
                .innerJoin(
                  "Collectible",
                  "Collectible.id",
                  "List.collectibleId"
                )
                .select("price")
                .where("Collectible.collectionId", "=", eb.ref("Collection.id"))
                .where("List.status", "=", "ACTIVE")
                .orderBy("price", "asc")
                .limit(1),
              sql<number>`0`
            )
            .as("floor")
        ])
        .where("Collectible.status", "=", "CONFIRMED");

      // Base condition - match inscription IDs and handle multiple collection IDs
      let baseCondition = (eb: any) => {
        let condition = eb("Collectible.uniqueIdx", "in", cleanInscriptionIds);

        // Handle multiple collection IDs with OR condition, ensuring proper type checking
        if (
          params.collectionIds &&
          Array.isArray(params.collectionIds) &&
          params.collectionIds.length > 0
        ) {
          // Create an array of conditions for each collection ID
          const collectionConditions = params.collectionIds.map((id) =>
            eb("Collectible.collectionId", "=", id)
          );

          // Combine conditions with OR
          condition = condition.and(eb.or(collectionConditions));
        }

        return condition;
      };

      // Add the base condition
      query = query.where(baseCondition);

      // Add listed condition if specified
      if (params.isListed) {
        query = query.where("CurrentList.status", "=", "ACTIVE");
      }

      if (params.query) {
        query = query.where((eb) =>
          eb(
            to_tsvector(eb.ref("Collectible.nftId")),
            "@@",
            to_tsquery(`${params.query}`)
          )
        );
      }

      switch (params.orderBy) {
        case "price":
          query = query
            .orderBy(
              sql`CASE WHEN COALESCE("CurrentList"."price", 0) > 0 THEN 0 ELSE 1 END`,
              "asc" // Always keep items with price > 0 first
            )
            .orderBy(
              sql`COALESCE("CurrentList"."price", 0)`,
              params.orderDirection === "desc" ? "desc" : "asc"
            )
            .orderBy("Collectible.nftId asc");
          break;

        case "recent":
          query = query
            .orderBy(
              sql`CASE WHEN "CurrentList"."listedAt" IS NOT NULL THEN 0 ELSE 1 END`,
              "asc" // Always keep listed items first
            )
            .orderBy(
              sql`COALESCE("CurrentList"."listedAt", '1970-01-01')`, // Use Unix epoch as default
              params.orderDirection === "desc" ? "desc" : "asc"
            )
            .orderBy("Collectible.nftId asc");
          break;

        default:
          query = query
            .orderBy(
              "Collectible.createdAt",
              params.orderDirection === "desc" ? "desc" : "asc"
            )
            .orderBy("Collectible.nftId asc");
      }

      // Execute query and log results for debugging
      const collectibles = await query
        .offset(params.offset)
        .limit(params.limit)
        .execute();

      return collectibles;
    } catch (error) {
      console.error("Error in getListableCollectiblesByInscriptionIds:", error);
      throw error;
    }
  },
  getListableCollectiblesCountByInscriptionIds: async (
    inscriptionIds: string[],
    params: CollectibleQueryParams,
    userId: string
  ) => {
    const cleanInscriptionIds = Array.isArray(inscriptionIds)
      ? inscriptionIds.map((id) => id.toString())
      : [];

    if (cleanInscriptionIds.length === 0) {
      return { count: 0 };
    }

    let query = db
      .selectFrom("Collectible")
      .leftJoin("List as CurrentList", (join) =>
        join
          .onRef("CurrentList.collectibleId", "=", "Collectible.id")
          .on("CurrentList.status", "=", "ACTIVE")
      )
      .select((eb) => [
        eb.fn.count<number>("Collectible.id").$castTo<number>().as("count")
      ])
      .where("Collectible.status", "=", "CONFIRMED")
      .where("Collectible.uniqueIdx", "in", inscriptionIds);

    // Base condition - match inscription IDs and handle multiple collection IDs
    let baseCondition = (eb: any) => {
      let condition = eb("Collectible.uniqueIdx", "in", cleanInscriptionIds);

      // Handle multiple collection IDs with OR condition, ensuring proper type checking
      if (
        params.collectionIds &&
        Array.isArray(params.collectionIds) &&
        params.collectionIds.length > 0
      ) {
        // Create an array of conditions for each collection ID
        const collectionConditions = params.collectionIds.map((id) =>
          eb("Collectible.collectionId", "=", id)
        );

        // Combine conditions with OR
        condition = condition.and(eb.or(collectionConditions));
      }

      return condition;
    };

    // Add the base condition
    query = query.where(baseCondition);

    // // Add listed condition if specified
    // if (params.isListed) {
    //   query = query.where("CurrentList.status", "=", "ACTIVE");
    // }

    if (params.query) {
      query = query.where((eb) =>
        eb(
          to_tsvector(eb.ref("Collectible.nftId")),
          "@@",
          to_tsquery(`${params.query}`)
        )
      );
    }

    const result = await query.executeTakeFirst();

    return result;
  },
  getListableCollectiblesByCollectionId: async (
    collectionId: string,
    params: CollectibleQueryParams,
    userId?: string
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
              .as("floor")
          ])
          .where("List.status", "=", "ACTIVE")
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
        "Collectible.highResolutionImageUrl",
        "Collectible.collectionId",
        "Collection.name as collectionName",
        "Collection.creatorName",
        "Collection.contractAddress",
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
        // Add isOwnListing boolean
        userId
          ? sql`(CASE WHEN "CurrentList"."sellerId" = ${userId} THEN true ELSE false END)::boolean`.as(
              "isOwnListing"
            )
          : sql`false`.as("isOwnListing")
      ])
      .where("Collectible.status", "=", "CONFIRMED")
      .where("Collection.status", "=", "CONFIRMED")
      .where("Collectible.collectionId", "=", collectionId);

    if (params.isListed)
      query = query.where("CurrentList.status", "=", "ACTIVE");

    if (params.query) {
      query = query.where((eb) =>
        eb(
          to_tsvector(eb.ref("Collectible.nftId")),
          "@@",
          to_tsquery(`${params.query}`)
        )
      );
    }

    // Filter by trait values
    if (params.traitValuesByType) {
      for (const [typeId, valueIds] of Object.entries(
        params.traitValuesByType
      )) {
        if (valueIds.length > 0) {
          query = query.where((eb) =>
            eb.exists(
              eb
                .selectFrom("CollectibleTrait")
                .innerJoin(
                  "TraitValue",
                  "TraitValue.id",
                  "CollectibleTrait.traitValueId"
                )
                .whereRef(
                  "CollectibleTrait.collectibleId",
                  "=",
                  "Collectible.id"
                )
                .where("TraitValue.traitTypeId", "=", typeId)
                .where("CollectibleTrait.traitValueId", "in", valueIds)
            )
          );
        }
      }
    }

    switch (params.orderBy) {
      case "price":
        query = query
          .orderBy(
            sql`CASE WHEN COALESCE("CurrentList"."price", 0) > 0 THEN 0 ELSE 1 END`,
            "asc" // Always keep items with price > 0 first
          )
          .orderBy(
            sql`COALESCE("CurrentList"."price", 0)`,
            params.orderDirection === "desc" ? "desc" : "asc"
          )
          .orderBy("Collectible.nftId asc");
        break;

      case "recent":
        query = query
          .orderBy(
            sql`CASE WHEN "CurrentList"."listedAt" IS NOT NULL THEN 0 ELSE 1 END`,
            "asc" // Always keep listed items first
          )
          .orderBy(
            sql`COALESCE("CurrentList"."listedAt", '1970-01-01')`, // Use Unix epoch as default
            params.orderDirection === "desc" ? "desc" : "asc"
          )
          .orderBy("Collectible.nftId asc");
        break;

      default:
        query = query
          .orderBy(
            "Collectible.createdAt",
            params.orderDirection === "desc" ? "desc" : "asc"
          )
          .orderBy("Collectible.nftId asc");
    }

    const collectibles = await query
      .offset(params.offset)
      .limit(params.limit)
      .execute();

    return collectibles;
  },
  getByIdWithDetails: async (id: string, userId?: string) => {
    const collectibles = await db
      .with("FloorPrices", (db) =>
        db
          .selectFrom("List")
          .rightJoin("Collectible", "List.collectibleId", "Collectible.id")
          .select((eb) => [
            "Collectible.collectionId",
            eb.fn
              .coalesce(sql<number>`MIN("List"."price")`, sql<number>`0`)
              .as("floor")
          ])
          .where("List.status", "=", "ACTIVE")
          .groupBy("Collectible.collectionId")
      )
      .selectFrom("Collectible")
      .innerJoin("Collection", "Collection.id", "Collectible.collectionId")
      .innerJoin("Layer", "Layer.id", "Collection.layerId")
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
      .leftJoin(
        "Collectible as parentCollectible",
        "parentCollectible.id",
        "Collectible.parentCollectibleId"
      )
      .select(({ eb }) => [
        "Collectible.id",
        "Collectible.name",
        "Collectible.uniqueIdx",
        "Collectible.createdAt",
        "Collectible.fileKey",
        "Collectible.highResolutionImageUrl",
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
        "parentCollectible.uniqueIdx as inscriptionId",
        "CurrentList.address as ownedBy",
        "CurrentList.listedAt",
        "CurrentList.id as listId",
        // Add isOwnListing boolean
        userId
          ? sql`(CASE WHEN "CurrentList"."sellerId" = ${userId} THEN true ELSE false END)::boolean`.as(
              "isOwnListing"
            )
          : sql`false`.as("isOwnListing"),
        "Layer.id as layerId",
        "Layer.name",
        "Layer.chainId",
        "Layer.currencyId",
        "Layer.layer",
        "Layer.network",
        "Layer.layerType"
      ])
      .where("Collectible.status", "=", "CONFIRMED")
      .where("Collectible.id", "=", id)
      .execute();

    return collectibles;
  },
  getConfirmedCollectiblesCountByCollectionId: async (
    collectionId: string,
    params: CollectibleQueryParams,
    userId?: string
  ) => {
    let query = db
      .selectFrom("Collectible")
      .leftJoin("List as CurrentList", (join) =>
        join
          .onRef("CurrentList.collectibleId", "=", "Collectible.id")
          .on("CurrentList.status", "=", "ACTIVE")
      )
      .select(({ eb }) => [
        eb.fn
          .coalesce(
            eb.fn.count("Collectible.id").$castTo<number>(),
            sql<number>`0`
          )
          .as("collectibleCount")
      ])
      .where("Collectible.collectionId", "=", collectionId)
      .where("Collectible.status", "=", "CONFIRMED");

    if (params.isListed)
      query = query.where("CurrentList.status", "=", "ACTIVE");

    if (params.query) {
      query = query.where((eb) =>
        eb(
          to_tsvector(eb.ref("Collectible.nftId")),
          "@@",
          to_tsquery(`${params.query}`)
        )
      );
    }

    // Filter by trait values
    if (params.traitValuesByType) {
      for (const [typeId, valueIds] of Object.entries(
        params.traitValuesByType
      )) {
        if (valueIds.length > 0) {
          query = query.where((eb) =>
            eb.exists(
              eb
                .selectFrom("CollectibleTrait")
                .innerJoin(
                  "TraitValue",
                  "TraitValue.id",
                  "CollectibleTrait.traitValueId"
                )
                .whereRef(
                  "CollectibleTrait.collectibleId",
                  "=",
                  "Collectible.id"
                )
                .where("TraitValue.traitTypeId", "=", typeId)
                .where("CollectibleTrait.traitValueId", "in", valueIds)
            )
          );
        }
      }
    }

    const countResult = query.executeTakeFirst();

    return countResult;
  },
  getListableCollectiblesCountByCollections: async (
    collectionIds: string[]
  ) => {
    const result = await db
      .selectFrom("Collectible")
      .select((eb) => [eb.fn.countAll().as("count")])
      .where("Collectible.collectionId", "in", collectionIds)
      .executeTakeFirst();

    return result;
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
        "Collectible.highResolutionImageUrl",
        "Collectible.collectionId",
        "Collectible.cid",
        "Layer.layer",
        "Layer.network"
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
  getCollectiblesWithNoCidByCollectionId: async (
    collectionId: string,
    offset: number,
    limit: number
  ) => {
    const collectibles = await db
      .selectFrom("Collectible")
      .selectAll()
      .where("Collectible.collectionId", "=", collectionId)
      .where("Collectible.cid", "is", null)
      .offset(offset)
      .limit(limit)
      .execute();

    return collectibles;
  },
  getCollectibleByFilename: async (filename: string) => {
    const collectible = await db
      .selectFrom("Collectible")
      .selectAll()
      .where("Collectible.fileName", "=", filename)
      .executeTakeFirst();

    return collectible;
  }
};
