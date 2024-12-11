import { Insertable, Kysely, sql, Transaction, Updateable } from "kysely";
import { db } from "../utils/db";
import { DB, Launch } from "../types/db/types";
import { LaunchQueryParams } from "./collectionRepository";

export const launchRepository = {
  create: async (
    db: Kysely<DB> | Transaction<DB>,
    data: Insertable<Launch>
  ) => {
    const launch = await db
      .insertInto("Launch")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow(() => new Error("Couldnt create the launch."));

    return launch;
  },
  update: async (id: string, data: Updateable<Launch>) => {
    const launch = await db
      .updateTable("Launch")
      .returningAll()
      .set(data)
      .where("Launch.id", "=", id)
      .executeTakeFirstOrThrow(() => new Error("Couldnt update the launch."));

    return launch;
  },
  delete: async (id: string) => {
    const launch = await db
      .deleteFrom("Launch")
      .returningAll()
      .where("Launch.id", "=", id)
      .executeTakeFirstOrThrow(() => new Error("Couldnt delete the launch."));

    return launch;
  },
  getById: async (id: string) => {
    const launch = await db
      .selectFrom("Launch")
      .selectAll()
      .where("Launch.id", "=", id)
      .executeTakeFirst();

    return launch;
  },
  getByCollectionId: async (collectionId: string) => {
    const launch = await db
      .selectFrom("Launch")
      .selectAll()
      .where("Launch.collectionId", "=", collectionId)
      .executeTakeFirst();

    return launch;
  },
  getLaunchItemCountByLaunchId: async (
    db: Kysely<DB> | Transaction<DB>,
    launchId: string
  ) => {
    const result = await db
      .selectFrom("LaunchItem")
      .innerJoin("Launch", "Launch.id", "LaunchItem.launchId")
      .select((eb) => [eb.fn.countAll().$castTo<number>().as("count")])
      .where("Launch.id", "=", launchId)
      .executeTakeFirst();

    return result?.count;
  },
  getConfirmedLaunchesByLayerId: async ({
    layerId,
    interval,
  }: LaunchQueryParams) => {
    const now = BigInt(Math.floor(Date.now() / 1000));

    let query = db
      .selectFrom("Launch")
      .innerJoin("Collection", "Collection.id", "Launch.collectionId")
      .select((eb) => [
        "Collection.id",
        "Collection.name",
        "Collection.creatorName",
        "Collection.description",
        "Collection.type",
        "Collection.logoKey",
        "Collection.layerId",
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
        "Launch.status",
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
            ), 0)`.as("supply"),
      ])
      .where("Collection.layerId", "=", layerId)
      .where("Launch.status", "=", "CONFIRMED");

    if (interval !== "all") {
      query = query.where((eb) => {
        if (interval === "live") {
          return eb.or([
            eb("Launch.poEndsAt", ">", now.toString()),
            eb("Launch.poEndsAt", "=", null),
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

    return collections.map((collection) => ({
      ...collection,
      wlStartsAt: collection.wlStartsAt ? Number(collection.wlStartsAt) : null,
      wlEndsAt: collection.wlEndsAt ? Number(collection.wlEndsAt) : null,
      poStartsAt: Number(collection.poStartsAt),
      poEndsAt: Number(collection.poEndsAt),
    }));
  },
  getConfirmedLaunchById: async (id: string) => {
    const collection = await db
      .selectFrom("Launch")
      .innerJoin("Collection", "Collection.id", "Launch.collectionId")
      .select([
        "Collection.id",
        "Collection.name",
        "Collection.creatorName",
        "Collection.description",
        "Collection.type",
        "Collection.logoKey",
        "Collection.layerId",
        "Collection.status",
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
      ), 0)`.as("supply"),
      ])
      .where("Launch.id", "=", id)
      .where("Launch.status", "=", "CONFIRMED")
      .executeTakeFirst();

    if (!collection) return null;

    return {
      ...collection,
      wlStartsAt: collection.wlStartsAt ? Number(collection.wlStartsAt) : null,
      wlEndsAt: collection.wlEndsAt ? Number(collection.wlEndsAt) : null,
      poStartsAt: Number(collection.poStartsAt),
      poEndsAt: Number(collection.poEndsAt),
    };
  },
};
