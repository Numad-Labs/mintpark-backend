import { ExpressionBuilder, Insertable, sql, Updateable } from "kysely";
import { db } from "../utils/db";
import { Collection, DB } from "../types/db/types";
import { QueryParams } from "../controllers/collectionController";
import { intervalMap } from "../libs/constants";

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
  update: async (id: string, data: Updateable<Collection>) => {
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
  getById: async (id: string) => {
    const collection = await db
      .selectFrom("Collection")
      .selectAll()
      .where("Collection.id", "=", id)
      .executeTakeFirst();

    return collection;
  },
  getUnconfirmedCollections: async () => {
    const collections = await db
      .selectFrom("Collection")
      .selectAll()
      .where("Collection.type", "=", "UNCONFIRMED")
      .execute();

    return collections;
  },
  getAllLaunchedCollections: async () => {
    const collections = await db
      .selectFrom("Collection")
      .selectAll()
      .where("Collection.type", "=", "LAUNCHED")
      .execute();

    return collections;
  },
  getAllLaunchedCollectionsByLayerId: async (layerId: string) => {
    const collections = await db
      .selectFrom("Collection")
      .selectAll()
      .where("Collection.layerId", "=", layerId)
      .where("Collection.type", "=", "LAUNCHED")
      .execute();

    return collections;
  },
  getListedCollections: async (params: QueryParams) => {
    let query = db
      .with("CollectionStats", (db) =>
        db.selectFrom("Collection").select(({ eb, selectFrom }) => [
          "Collection.id",
          selectFrom("List")
            .rightJoin("Collectible", "Collectible.id", "List.collectibleId")
            .select((eb) => [
              sql<number>`COALESCE(MIN("List"."price"), 0)`.as("floor"),
            ])
            .where("Collectible.collectionId", "=", eb.ref("Collection.id"))
            .as("floor"),
          selectFrom("List")
            .rightJoin("Collectible", "Collectible.id", "List.collectibleId")
            .select((eb) => [
              sql<number>`COALESCE(SUM("List"."price"), 0)`.as("volume"),
            ])
            .where("Collectible.collectionId", "=", eb.ref("Collection.id"))
            .where("List.status", "=", "SOLD")
            .as("volume"),
          selectFrom("List")
            .rightJoin("Collectible", "Collectible.id", "List.collectibleId")
            .select((eb) => [
              sql<number>`COALESCE(COUNT("List"."price"), 0)`
                .$castTo<number>()
                .as("listedCount"),
            ])
            .where("Collectible.collectionId", "=", eb.ref("Collection.id"))
            .as("listedCount"),
          selectFrom("List")
            .rightJoin("Collectible", "Collectible.id", "List.collectibleId")
            .select((eb) => [
              sql<number>`COALESCE(COUNT("List"."price"), 0)`
                .$castTo<number>()
                .as("soldCount"),
            ])
            .where("Collectible.collectionId", "=", eb.ref("Collection.id"))
            .where("List.status", "=", "SOLD")
            .as("soldCount"),
        ])
      )
      .selectFrom("Collection")
      .leftJoin("CollectionStats", "CollectionStats.id", "Collection.id")
      .select(({ eb }) => [
        "Collection.id",
        "Collection.name",
        "Collection.creator",
        "Collection.description",
        "Collection.supply",
        "Collection.type",
        "Collection.logoKey",
        "Collection.layerId",
        "CollectionStats.floor",
        "CollectionStats.volume",
        "CollectionStats.listedCount",
        "CollectionStats.soldCount",
        sql<number>`"CollectionStats"."floor" * "Collection"."supply"`.as(
          "marketCap"
        ),
      ])
      .where("Collection.layerId", "=", params.layerId)
      .where("Collection.type", "=", "MINTED");

    // if (params.interval && params.interval !== "All") {
    //   const intervalSeconds = intervalMap[params.interval];
    //   query = query.where(
    //     sql`"listedAt" > NOW() - INTERVAL '${intervalSeconds} seconds'`.$castTo<boolean>()
    //   );
    // }

    if (params.orderBy && params.orderDirection) {
      const direction = params.orderDirection === "highest" ? "desc" : "asc";
      if (params.orderBy === "volume") {
        query = query.orderBy("volume", direction);
      } else if (params.orderBy === "floor") {
        query = query.orderBy("floor", direction);
      }
    }

    const results = await query.execute();

    return results;
  },
};
