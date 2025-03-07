import { Insertable, Kysely, sql, Transaction, Updateable } from "kysely";
import { db } from "../utils/db";
import { DB, Launch } from "../types/db/types";
import { LaunchQueryParams } from "./collectionRepository";
import logger from "../config/winston";
import { LAUNCH_ITEM_STATUS } from "../types/db/enums";

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
  getById: async (db: Kysely<DB> | Transaction<DB>, id: string) => {
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
      .select((eb) => [eb.fn.countAll().$castTo<number>().as("count")])
      .where("LaunchItem.launchId", "=", launchId)
      .executeTakeFirst();

    return result?.count;
  },
  getConfirmedLaunchesByLayerId: async ({
    layerId,
    interval
  }: LaunchQueryParams) => {
    const now = BigInt(Math.floor(Date.now() / 1000));

    let query = db
      .selectFrom("Launch")
      .innerJoin(
        "Collection as parentCollection",
        "parentCollection.id",
        "Launch.collectionId"
      )
      .leftJoin(
        "Collection as childCollection",
        "childCollection.parentCollectionId",
        "parentCollection.id"
      )
      .select((eb) => [
        "parentCollection.id",
        "parentCollection.name",
        "parentCollection.creatorName",
        "parentCollection.description",
        "parentCollection.type",
        "parentCollection.logoKey",
        "parentCollection.layerId",
        "parentCollection.discordUrl",
        "parentCollection.twitterUrl",
        "parentCollection.websiteUrl",
        "Launch.id as launchId",

        "Launch.hasFCFS",
        "Launch.fcfsStartsAt",
        "Launch.fcfsEndsAt",
        "Launch.fcfsMintPrice",
        "Launch.fcfsMaxMintPerWallet",

        "Launch.isWhitelisted",
        "Launch.wlStartsAt",
        "Launch.wlEndsAt",
        "Launch.wlMintPrice",
        "Launch.wlMaxMintPerWallet",

        "Launch.poStartsAt",
        "Launch.poEndsAt",
        "Launch.poMintPrice",
        "Launch.poMaxMintPerWallet",

        "Launch.createdAt",
        "Launch.status",
        "childCollection.layerId as layerId",
        sql<number>`COALESCE((
          SELECT COUNT(*)::integer
          FROM "LaunchItem"
          WHERE "LaunchItem"."launchId" = "Launch"."id"
          AND ("LaunchItem"."status" = 'SOLD' OR "LaunchItem"."status" = 'RESERVED')
        ), 0)`.as("mintedAmount"),
        sql<number>`COALESCE((
              SELECT COUNT(*)::integer
              FROM "LaunchItem"
              WHERE "LaunchItem"."launchId" = "Launch"."id"
            ), 0)`.as("supply"),
        "parentCollection.badgeSupply",
        "parentCollection.isBadge"
      ])
      .where((eb) =>
        eb.or([
          eb("childCollection.layerId", "=", layerId),
          eb("parentCollection.layerId", "=", layerId)
        ])
      )
      .where("Launch.status", "=", "CONFIRMED");

    if (interval !== "all") {
      query = query.where((eb) => {
        if (interval === "live") {
          return eb.or([
            // Whitelist is active
            eb.and([
              eb("Launch.wlStartsAt", "is not", null),
              eb("Launch.wlEndsAt", "is not", null),
              eb("Launch.wlStartsAt", "<=", now.toString()),
              eb("Launch.wlEndsAt", ">=", now.toString())
            ]),
            // FCFS is active
            eb.and([
              eb("Launch.fcfsStartsAt", "is not", null),
              eb("Launch.fcfsEndsAt", "is not", null),
              eb("Launch.fcfsStartsAt", "<=", now.toString()),
              eb("Launch.fcfsEndsAt", ">=", now.toString())
            ]),
            // Public sale is active
            eb.and([
              eb("Launch.poStartsAt", "<=", now.toString()),
              eb.or([
                eb("Launch.poEndsAt", "is", null),
                eb("Launch.poEndsAt", ">", now.toString())
              ])
            ]),
            //Whitelist hasn't started
            eb("Launch.wlStartsAt", ">", now.toString()),
            //FCFS hasn't started
            eb("Launch.fcfsStartsAt", ">", now.toString()),
            //PO hasn't started
            eb("Launch.poStartsAt", ">", now.toString())
          ]);
        } else {
          // Ended interval
          return eb.and([
            // Public sale has ended
            eb("Launch.poEndsAt", "is not", null),
            eb("Launch.poEndsAt", "<=", now.toString()),
            // Whitelist either never existed or has ended
            eb.or([
              // No whitelist
              eb.or([
                eb("Launch.wlStartsAt", "is", null),
                eb("Launch.wlEndsAt", "is", null)
              ]),
              // Whitelist has ended
              eb("Launch.wlEndsAt", "<=", now.toString())
            ]),
            // FCFS either never existed or has ended
            eb.or([
              // No FCFS
              eb.or([
                eb("Launch.fcfsStartsAt", "is", null),
                eb("Launch.fcfsEndsAt", "is", null)
              ]),
              // FCFS has ended
              eb("Launch.fcfsEndsAt", "<=", now.toString())
            ])
          ]);
        }
      });
    }

    const collections = await query.orderBy("Launch.createdAt desc").execute();

    return collections.map((collection) => ({
      ...collection,
      wlStartsAt: collection.wlStartsAt ? Number(collection.wlStartsAt) : null,
      wlEndsAt: collection.wlEndsAt ? Number(collection.wlEndsAt) : null,
      poStartsAt: Number(collection.poStartsAt),
      poEndsAt: Number(collection.poEndsAt)
    }));
  },
  getConfirmedLaunchById: async (collectionId: string) => {
    const collection = await db
      .selectFrom("Launch")
      .innerJoin(
        "Collection as parentCollection",
        "parentCollection.id",
        "Launch.collectionId"
      )
      .leftJoin(
        "Collection as childCollection",
        "childCollection.parentCollectionId",
        "parentCollection.id"
      )
      .select([
        "parentCollection.id",
        "parentCollection.name",
        "parentCollection.creatorName",
        "parentCollection.description",
        "parentCollection.type",
        "parentCollection.logoKey",
        "parentCollection.layerId",
        "parentCollection.status",
        "parentCollection.discordUrl",
        "parentCollection.twitterUrl",
        "parentCollection.websiteUrl",
        "parentCollection.contractAddress",
        "Launch.id as launchId",

        "Launch.isWhitelisted",
        "Launch.wlStartsAt",
        "Launch.wlEndsAt",
        "Launch.wlMintPrice",
        "Launch.wlMaxMintPerWallet",

        "Launch.hasFCFS",
        "Launch.fcfsStartsAt",
        "Launch.fcfsEndsAt",
        "Launch.fcfsMintPrice",
        "Launch.fcfsMaxMintPerWallet",

        "Launch.poStartsAt",
        "Launch.poEndsAt",
        "Launch.poMintPrice",
        "Launch.poMaxMintPerWallet",
        "Launch.createdAt",
        sql<number>`COALESCE((
        SELECT COUNT(*)::integer
        FROM "LaunchItem"
        WHERE "LaunchItem"."launchId" = "Launch"."id"
        AND ("LaunchItem"."status" = 'SOLD' OR "LaunchItem"."status" = 'RESERVED')
      ), 0)`.as("mintedAmount"),
        sql<number>`COALESCE((
        SELECT COUNT(*)::integer
        FROM "LaunchItem"
        WHERE "LaunchItem"."launchId" = "Launch"."id"
      ), 0)`.as("supply"),
        "parentCollection.badgeSupply",
        "parentCollection.isBadge"
      ])
      .where("parentCollection.id", "=", collectionId)
      .where("Launch.status", "=", "CONFIRMED")
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
  getLaunchItemCountByLaunchIdAndStatus: async (
    launchId: string,
    status: LAUNCH_ITEM_STATUS
  ) => {
    const result = await db
      .selectFrom("LaunchItem")
      .select((eb) => [eb.fn.countAll().$castTo<number>().as("count")])
      .where("LaunchItem.launchId", "=", launchId)
      .where("LaunchItem.status", "=", status)
      .executeTakeFirst();

    return result?.count;
  }
};
