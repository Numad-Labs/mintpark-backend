import {
  ExpressionBuilder,
  Insertable,
  Kysely,
  sql,
  Transaction,
  Updateable
} from "kysely";
import { db } from "../utils/db";
import { Collection, DB } from "../types/db/types";
import { CollectionQueryParams } from "../controllers/collectionController";

export interface LaunchQueryParams {
  layerId: string;
  interval: "all" | "live" | "past";
}

type Interval = "1h" | "24h" | "7d" | "30d" | "all";

function getIntervalCondition(interval: Interval, dateColumn: string) {
  switch (interval) {
    case "1h":
      return sql`"${sql.raw(dateColumn)}" >= NOW() - INTERVAL '1 hour'`;
    case "24h":
      return sql`"${sql.raw(dateColumn)}" >= NOW() - INTERVAL '24 hours'`;
    case "7d":
      return sql`"${sql.raw(dateColumn)}" >= NOW() - INTERVAL '7 days'`;
    case "30d":
      return sql`"${sql.raw(dateColumn)}" >= NOW() - INTERVAL '30 days'`;
    case "all":
      return sql`1=1`;
    default:
      throw new Error(`Invalid interval: ${interval}`);
  }
}

export const collectionRepository = {
  create: async (data: Insertable<Collection>) => {
    const collection = await db
      .insertInto("Collection")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow(
        () => new Error("Couldnt create the collection.")
      );

    return collection;
  },
  update: async (
    db: Kysely<DB> | Transaction<DB>,
    id: string,
    data: Updateable<Collection>
  ) => {
    const collection = await db
      .updateTable("Collection")
      .returningAll()
      .set(data)
      .where("Collection.id", "=", id)
      .executeTakeFirstOrThrow(
        () => new Error("Couldnt update the collection.")
      );

    return collection;
  },
  delete: async (id: string) => {
    const collection = await db
      .deleteFrom("Collection")
      .returningAll()
      .where("Collection.id", "=", id)
      .executeTakeFirstOrThrow(
        () => new Error("Couldnt delete the collection.")
      );

    return collection;
  },
  getById: async (db: Kysely<DB> | Transaction<DB>, id: string) => {
    const collection = await db
      .selectFrom("Collection")
      .selectAll()
      .where("Collection.id", "=", id)
      .executeTakeFirst();

    return collection;
  },
  // getUnconfirmedCollections: async () => {
  //   const collections = await db
  //     .selectFrom("Collection")
  //     .selectAll()
  //     .where("Collection.type", "=", "UNCONFIRMED")
  //     .execute();

  //   return collections;
  // },
  getAllLaunchedCollectionsByLayerId: async ({
    layerId,
    interval
  }: LaunchQueryParams) => {
    // Get current timestamp in milliseconds
    const now = BigInt(Math.floor(Date.now() / 1000));

    let query = db
      .selectFrom("Collection")
      .innerJoin("Launch", "Collection.id", "Launch.collectionId")
      .select((eb) => [
        "Collection.id",
        "Collection.name",
        "Collection.description",
        "Collection.type",
        "Collection.logoKey",
        "Collection.layerId",
        "Collection.creatorName",
        "Collection.twitterUrl",
        "Collection.discordUrl",
        "Collection.websiteUrl",
        "Launch.id as launchId",
        "Launch.wlStartsAt",
        "Launch.wlEndsAt",
        "Launch.wlMintPrice",
        "Launch.wlMaxMintPerWallet",
        "Launch.poStartsAt",
        "Launch.poEndsAt",
        "Launch.poMintPrice",
        "Launch.poMaxMintPerWallet",
        "Launch.isWhitelisted",
        "Launch.createdAt",
        sql<number>`COALESCE((
          SELECT COUNT(*)::integer
          FROM "LaunchItem"
          WHERE "LaunchItem"."launchId" = "Launch"."id"
          AND "LaunchItem"."status" = 'SOLD'
        ), 0)`.as("mintedAmount"),
        sql<number>`COALESCE((
          SELECT COUNT(*)::integer
          FROM "LaunchItem"
          WHERE "LaunchItem"."launchId" = "Launch"."id"
        ), 0)`.as("supply")
      ])
      .where("Collection.layerId", "=", layerId)
      .where("Collection.status", "!=", "UNCONFIRMED")
      .where("Launch.id", "is not", null);

    if (interval !== "all") {
      query = query.where((eb) => {
        if (interval === "live") {
          return eb.or([
            eb("Launch.poEndsAt", ">", now.toString()),
            eb("Launch.poEndsAt", "=", null)
            // eb.and([
            //   eb("Launch.wlStartsAt", "is not", null),
            //   eb("Launch.wlEndsAt", "is not", null),
            //   eb("Launch.wlEndsAt", "<=", now.toString()),
            // ]),
          ]);
        } else {
          // return eb.and([
          //   eb("Launch.poEndsAt", ">", now.toString()),
          //   eb.or([
          //     eb("Launch.wlEndsAt", "is not", null),
          //     eb("Launch.wlEndsAt", ">", now.toString()),
          //   ]),
          // ]);
          return eb("Launch.poEndsAt", "<=", now.toString());
        }
      });
    }

    const collections = await query.execute();

    // Convert timestamps from seconds to milliseconds for consistency
    return collections.map((collection) => ({
      ...collection,
      wlStartsAt: collection.wlStartsAt ? Number(collection.wlStartsAt) : null,
      wlEndsAt: collection.wlEndsAt ? Number(collection.wlEndsAt) : null,
      poStartsAt: Number(collection.poStartsAt),
      poEndsAt: Number(collection.poEndsAt)
    }));
  },
  getLaunchedCollectionById: async (id: string) => {
    const collection = await db
      .selectFrom("Collection")
      .innerJoin("Launch", "Collection.id", "Launch.collectionId")
      .select([
        "Collection.id",
        "Collection.name",
        "Collection.description",
        "Collection.type",
        "Collection.logoKey",
        "Collection.layerId",
        "Collection.status",
        "Collection.creatorName",
        "Collection.twitterUrl",
        "Collection.discordUrl",
        "Collection.websiteUrl",
        "Launch.id as launchId",
        "Launch.wlStartsAt",
        "Launch.wlEndsAt",
        "Launch.wlMintPrice",
        "Launch.wlMaxMintPerWallet",
        "Launch.poStartsAt",
        "Launch.poEndsAt",
        "Launch.poMintPrice",
        "Launch.poMaxMintPerWallet",
        "Launch.isWhitelisted",
        "Launch.createdAt",
        sql<number>`COALESCE((
          SELECT COUNT(*)::integer
          FROM "LaunchItem"
          WHERE "LaunchItem"."launchId" = "Launch"."id"
          AND "LaunchItem"."status" = 'SOLD'
        ), 0)`.as("mintedAmount"),
        "Collection.contractAddress",
        sql<number>`COALESCE((
          SELECT COUNT(*)::integer
          FROM "LaunchItem"
          WHERE "LaunchItem"."launchId" = "Launch"."id"
        ), 0)`.as("supply")
      ])
      .where("Collection.id", "=", id)
      .where("Launch.id", "is not", null)
      .executeTakeFirst();

    if (!collection) return null;

    return {
      ...collection,
      wlStartsAt: collection.wlStartsAt ? Number(collection.wlStartsAt) : null,
      wlEndsAt: collection.wlEndsAt ? Number(collection.wlEndsAt) : null,
      poStartsAt: Number(collection.poStartsAt),
      poEndsAt: Number(collection.poEndsAt)
    };
  },
  getListedCollections: async (params: CollectionQueryParams) => {
    let query = db
      .with("CollectionStats", (db) =>
        db.selectFrom("Collection").select(({ eb, selectFrom }) => [
          "Collection.id",
          selectFrom("List")
            .rightJoin("Collectible", "Collectible.id", "List.collectibleId")
            .select((eb) => [
              sql<number>`COALESCE(MIN("List"."price"), 0)`.as("floor")
            ])
            .where("Collectible.collectionId", "=", eb.ref("Collection.id"))
            .where("List.status", "=", "ACTIVE")
            .where(
              getIntervalCondition(
                params.interval,
                "listedAt"
              ).$castTo<boolean>()
            )
            .as("floor"),
          selectFrom("List")
            .rightJoin("Collectible", "Collectible.id", "List.collectibleId")
            .select((eb) => [
              sql<number>`COALESCE(SUM("List"."price"), 0)`.as("volume")
            ])
            .where("Collectible.collectionId", "=", eb.ref("Collection.id"))
            .where("List.status", "=", "SOLD")
            .where(
              getIntervalCondition(
                params.interval,
                "listedAt"
              ).$castTo<boolean>()
            )
            .as("volume"),
          selectFrom("List")
            .rightJoin("Collectible", "Collectible.id", "List.collectibleId")
            .select((eb) => [
              sql<number>`COALESCE(COUNT("List"."price"), 0)`
                .$castTo<number>()
                .as("listedCount")
            ])
            .where("Collectible.collectionId", "=", eb.ref("Collection.id"))
            .where(
              getIntervalCondition(
                params.interval,
                "listedAt"
              ).$castTo<boolean>()
            )
            .as("listedCount"),
          selectFrom("List")
            .rightJoin("Collectible", "Collectible.id", "List.collectibleId")
            .select((eb) => [
              sql<number>`COALESCE(COUNT("List"."price"), 0)`
                .$castTo<number>()
                .as("soldCount")
            ])
            .where("Collectible.collectionId", "=", eb.ref("Collection.id"))
            .where("List.status", "in", ["ACTIVE", "SOLD"])
            .where(
              getIntervalCondition(
                params.interval,
                "listedAt"
              ).$castTo<boolean>()
            )
            .as("soldCount")
        ])
      )
      .selectFrom("Collection")
      .leftJoin("CollectionStats", "CollectionStats.id", "Collection.id")
      .select(({ eb, selectFrom }) => [
        "Collection.id",
        "Collection.name",
        "Collection.description",
        // "Collection.supply",
        selectFrom("Collectible")
          .select((eb) => [
            sql<number>`COUNT("Collectible"."id")`
              .$castTo<number>()
              .as("confirmedSupply")
          ])
          .where("Collectible.collectionId", "=", eb.ref("Collection.id"))
          .where("Collectible.status", "=", "CONFIRMED")
          .as("supply"),
        "Collection.type",
        "Collection.logoKey",
        "Collection.contractAddress",
        "Collection.layerId",
        "Collection.creatorName",
        "CollectionStats.floor",
        "CollectionStats.volume",
        "CollectionStats.listedCount",
        "CollectionStats.soldCount",
        "Collection.ownerCount",
        sql<number>`"CollectionStats"."floor" * "Collection"."supply"`.as(
          "marketCap"
        ),
        "Collection.discordUrl",
        "Collection.twitterUrl",
        "Collection.websiteUrl",
        "Collection.iconUrl",
        "Collection.inscriptionIcon",
        "Collection.slug",
        "Collection.isBadge",
        "Collection.badgeSupply"
      ])
      .where("Collection.layerId", "=", params.layerId)
      .where("Collection.status", "=", "CONFIRMED");

    const direction = params.orderDirection === "lowest" ? "asc" : "desc";
    if (params.orderBy && params.orderDirection) {
      if (params.orderBy === "volume") {
        query = query.orderBy("volume", direction);
      } else if (params.orderBy === "floor") {
        query = query.orderBy("floor", direction);
      } else {
        query = query.orderBy("marketCap", direction);
      }
    } else query = query.orderBy("marketCap", direction);

    const results = await query.execute();

    return results;
  },
  getByIdWithDetails: async (id: string) => {
    const collection = await db
      .with("CollectionStats", (db) =>
        db.selectFrom("Collection").select(({ eb, selectFrom }) => [
          "Collection.id",
          selectFrom("List")
            .rightJoin("Collectible", "Collectible.id", "List.collectibleId")
            .select((eb) => [
              sql<number>`COALESCE(MIN("List"."price"), 0)`.as("floor")
            ])
            .where("Collectible.collectionId", "=", eb.ref("Collection.id"))
            .where("List.status", "=", "ACTIVE")
            .as("floor"),
          selectFrom("List")
            .rightJoin("Collectible", "Collectible.id", "List.collectibleId")
            .select((eb) => [
              sql<number>`COALESCE(SUM("List"."price"), 0)`.as("volume")
            ])
            .where("Collectible.collectionId", "=", eb.ref("Collection.id"))
            .where("List.status", "=", "SOLD")
            .as("volume"),
          selectFrom("List")
            .rightJoin("Collectible", "Collectible.id", "List.collectibleId")
            .select((eb) => [
              sql<number>`COALESCE(COUNT("List"."price"), 0)`
                .$castTo<number>()
                .as("listedCount")
            ])
            .where("Collectible.collectionId", "=", eb.ref("Collection.id"))
            .as("listedCount"),
          selectFrom("List")
            .rightJoin("Collectible", "Collectible.id", "List.collectibleId")
            .select((eb) => [
              sql<number>`COALESCE(COUNT("List"."price"), 0)`
                .$castTo<number>()
                .as("soldCount")
            ])
            .where("Collectible.collectionId", "=", eb.ref("Collection.id"))
            .where("List.status", "=", "SOLD")
            .as("soldCount")
        ])
      )
      .selectFrom("Collection")
      .leftJoin("CollectionStats", "CollectionStats.id", "Collection.id")
      .select(({ eb, selectFrom }) => [
        "Collection.id",
        "Collection.name",
        "Collection.description",
        // "Collection.supply",
        selectFrom("Collectible")
          .select((eb) => [
            sql<number>`COUNT("Collectible"."id")`
              .$castTo<number>()
              .as("confirmedSupply")
          ])
          .where("Collectible.collectionId", "=", eb.ref("Collection.id"))
          .where("Collectible.status", "=", "CONFIRMED")
          .as("supply"),
        "Collection.type",
        "Collection.logoKey",
        "Collection.layerId",
        "Collection.creatorName",
        "CollectionStats.floor",
        "CollectionStats.volume",
        "CollectionStats.listedCount",
        "CollectionStats.soldCount",
        sql<number>`"CollectionStats"."floor" * "Collection"."supply"`.as(
          "marketCap"
        ),
        "Collection.discordUrl",
        "Collection.twitterUrl",
        "Collection.websiteUrl",
        "Collection.iconUrl",
        "Collection.inscriptionIcon",
        "Collection.contractAddress",
        "Collection.slug",
        "Collection.isBadge",
        "Collection.badgeSupply",
        "Collection.ownerCount"
      ])
      .where("Collection.status", "=", "CONFIRMED")
      .where("Collection.id", "=", id)
      .executeTakeFirst();

    return collection;
  },
  getListedCollectionsWithCollectibleCountByInscriptionIds: async (
    inscriptionIds: string[]
  ) => {
    const collections = await db
      .selectFrom("Collection")
      .innerJoin("Collectible", "Collectible.collectionId", "Collection.id")
      .select((eb) => [
        "Collection.id",
        "Collection.name",
        "Collection.logoKey",
        "Collection.inscriptionIcon",
        "Collection.iconUrl",
        eb.fn
          .count<number>("Collectible.id")
          .filterWhere("Collectible.collectionId", "=", eb.ref("Collection.id"))
          .filterWhere("Collectible.uniqueIdx", "in", inscriptionIds)
          .as("collectibleCount")
      ])
      .where("Collectible.uniqueIdx", "in", inscriptionIds)
      .groupBy("Collection.id")
      .execute();

    return collections;
  },
  getCollectionsByLayer: async (layerId: string) => {
    let collections = db
      .selectFrom("Collection")
      .innerJoin("Layer", "Layer.id", "Collection.layerId")
      .selectAll()
      .where("Layer.id", "=", layerId)
      .where("Collection.contractAddress", "is not", null)
      // .where("Collection.status", "=", "CONFIRMED")
      .execute();

    return collections;
  },
  incrementCollectionSupplyById: async (
    db: Kysely<DB> | Transaction<DB>,
    id: string
  ) => {
    const collection = await db
      .updateTable("Collection")
      .set((eb) => ({ supply: eb("Collection.supply", "+", 1) }))
      .where("Collection.id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow(
        () => new Error("Could not increment the bonus current supply.")
      );

    return collection;
  },
  getByContractAddress: async (contractAddress: string) => {
    const collection = await db
      .selectFrom("Collection")
      .selectAll()
      .where("Collection.contractAddress", "=", contractAddress)
      .executeTakeFirst();

    return collection;
  },
  getChildCollectionByParentCollectionId: async (
    db: Kysely<DB> | Transaction<DB>,
    collectionId: string
  ) => {
    const collection = await db
      .selectFrom("Collection")
      .selectAll()
      .where("Collection.parentCollectionId", "=", collectionId)
      .where("Collection.type", "=", "SYNTHETIC")
      .executeTakeFirst();

    return collection;
  },
  countEvmCollections: async () => {
    const result = await db
      .selectFrom("Collection")
      .select((eb) => [eb.fn.countAll().$castTo<number>().as("count")])
      .where("Collection.type", "in", ["SYNTHETIC", "IPFS_CID", "IPFS_FILE"])
      .where("Collection.status", "=", "CONFIRMED")
      .where("contractAddress", "is not", null)
      .executeTakeFirst();

    return result?.count;
  },
  getEvmCollectionsWithOffsetAndPagination: async (
    offset: number,
    pagination: number
  ) => {
    const result = await db
      .selectFrom("Collection")
      .innerJoin("Layer", "Layer.id", "Collection.layerId")
      .selectAll()
      .where("Collection.type", "in", ["IPFS_CID", "IPFS_FILE", "SYNTHETIC"])
      .where("Collection.status", "=", "CONFIRMED")

      .offset(offset)
      .limit(pagination)
      .orderBy("createdAt asc")
      .execute();

    return result;
  },
  incrementBadgeCurrentNftIdById: async (
    db: Kysely<DB> | Transaction<DB>,
    id: string
  ) => {
    const collection = await db
      .updateTable("Collection")
      .set((eb) => ({
        badgeCurrentNftId: eb("Collection.badgeCurrentNftId", "+", 1)
      }))
      .returning(["Collection.badgeCurrentNftId"])
      .where("Collection.id", "=", id)
      .executeTakeFirstOrThrow(
        () => new Error("Could not increment badge current nft id.")
      );

    return collection;
  }
};
