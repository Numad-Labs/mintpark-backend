import { ExpressionBuilder, Insertable, sql, Updateable } from "kysely";
import { db } from "../utils/db";
import { Collection, DB } from "../types/db/types";
import { QueryParams } from "../controllers/collectionController";

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
      .selectFrom("Collection")
      .innerJoin("Collectible", "Collectible.collectionId", "Collection.id")
      .leftJoin("List", "List.collectibleId", "Collectible.id")
      .select((eb) => [
        "Collection.id",
        "Collection.name",
        "Collection.creator",
        "Collection.description",
        "Collection.supply",
        "Collection.type",
        "Collection.logoKey",
        "Collection.layerId",
        eb.fn.min("List.price").as("floor"),
        eb.fn
          .sum(
            eb
              .case()
              .when("List.status", "=", "SOLD")
              .then("List.price")
              .else(0)
              .end()
          )
          .as("volume"),
      ])
      .groupBy("Collectible.id")
      .where("Collection.layerId", "=", params.layerId);

    // Filter by date interval
    if (params.interval && params.interval !== "All") {
      const intervalMap: { [key: string]: number } = {
        "1h": 60 * 60,
        "24h": 24 * 60 * 60,
        "7d": 7 * 24 * 60 * 60,
        "30d": 30 * 24 * 60 * 60,
      };

      const intervalSeconds = intervalMap[params.interval];
      if (intervalSeconds) {
        // query = query.where(
        //   "List.listedAt",
        //   ">",
        //   sql`List.listedAt >= CURRENT_TIMESTAMP - INTERVAL '24 hours'`
        // );
      }
    }
  },
};
