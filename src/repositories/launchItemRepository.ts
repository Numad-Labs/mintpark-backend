import { Insertable, Kysely, sql, Transaction, Updateable } from "kysely";
import { db } from "../utils/db";
import { DB, LaunchItem } from "../types/db/types";
import { ON_HOLD_MINUTES } from "../libs/constants";
import { LAUNCH_ITEM_STATUS } from "../types/db/enums";

export const launchItemRepository = {
  create: async (data: Insertable<LaunchItem>) => {
    const launchItem = await db
      .insertInto("LaunchItem")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow(
        () => new Error("Couldnt create the launch item.")
      );

    return launchItem;
  },
  createOnHoldLaunchItem: async (
    db: Kysely<DB> | Transaction<DB>,
    data: Insertable<LaunchItem>,
    userId: string
  ) => {
    const ninetySecondsFromNow = new Date(Date.now() + 90 * 1000).toISOString();

    const launchItem = await db
      .insertInto("LaunchItem")
      .values({
        ...data,
        onHoldUntil: ninetySecondsFromNow,
        onHoldBy: userId
      })
      .returningAll()
      .executeTakeFirstOrThrow(
        () => new Error("Couldnt create the launch item.")
      );

    return launchItem;
  },
  update: async (
    db: Kysely<DB> | Transaction<DB>,
    id: string,
    data: Updateable<LaunchItem>
  ) => {
    const launchItem = await db
      .updateTable("LaunchItem")
      .returningAll()
      .set(data)
      .where("LaunchItem.id", "=", id)
      .executeTakeFirstOrThrow(
        () => new Error("Couldnt update the launch item.")
      );

    return launchItem;
  },
  delete: async (id: string) => {
    const launchItem = await db
      .deleteFrom("LaunchItem")
      .returningAll()
      .where("LaunchItem.id", "=", id)
      .executeTakeFirstOrThrow(
        () => new Error("Couldnt delete the launch item.")
      );

    return launchItem;
  },
  getById: async (db: Kysely<DB> | Transaction<DB>, id: string) => {
    const launchItem = await db
      .selectFrom("LaunchItem")
      .selectAll()
      .where("LaunchItem.id", "=", id)
      .executeTakeFirst();

    return launchItem;
  },
  getByLaunchId: async (launchId: string) => {
    const launchItems = await db
      .selectFrom("LaunchItem")
      .selectAll()
      .where("LaunchItem.launchId", "=", launchId)
      .execute();

    return launchItems;
  },
  getRandomItemByLaunchId: async (launchId: string) => {
    const currentDate = new Date().toISOString();

    const launchItem = await db
      .selectFrom("LaunchItem")
      .selectAll()
      .where("LaunchItem.launchId", "=", launchId)
      .where("LaunchItem.status", "=", "ACTIVE")
      .where((eb) =>
        eb.or([
          eb("LaunchItem.onHoldUntil", "is", null),
          sql`${eb.ref("onHoldUntil")} < ${currentDate}`.$castTo<boolean>()
        ])
      )
      .limit(1)
      .executeTakeFirst();

    return launchItem;
  },
  setShortHoldById: async (
    db: Kysely<DB> | Transaction<DB>,
    id: string,
    buyerId: string
  ) => {
    const ninetySecondsFromNow = new Date(Date.now() + 90 * 1000).toISOString();
    const currentDate = new Date().toISOString();

    const launchItem = await db
      .updateTable("LaunchItem")
      .set({
        onHoldUntil: ninetySecondsFromNow,
        onHoldBy: buyerId
      })
      .returningAll()
      .where("LaunchItem.id", "=", id)
      .where("LaunchItem.status", "=", "ACTIVE")
      .where((eb) =>
        eb.or([
          eb("LaunchItem.onHoldUntil", "is", null),
          // eb("LaunchItem.onHoldUntil", "<", currentDate)
          sql`${eb.ref(
            "LaunchItem.onHoldUntil"
          )} < ${currentDate}`.$castTo<boolean>()
        ])
      )
      .executeTakeFirst();

    return launchItem;
  },
  // Get item's current hold status
  getOnHoldById: async (db: Kysely<DB> | Transaction<DB>, id: string) => {
    const currentDate = new Date().toISOString();

    const launchItem = await db
      .selectFrom("LaunchItem")
      .selectAll()
      .where("LaunchItem.id", "=", id)
      .where("LaunchItem.status", "=", "ACTIVE")
      .where((eb) =>
        sql`${eb.ref("onHoldUntil")} >= ${currentDate}`.$castTo<boolean>()
      )
      .executeTakeFirst();

    return launchItem;
  },

  // Count short holds (items held for less than 2 minutes)
  getShortHoldCountByLaunchIdAndUserId: async (
    db: Kysely<DB> | Transaction<DB>,
    launchId: string,
    userId: string
  ) => {
    const currentDate = new Date().toISOString();

    const result = await db
      .selectFrom("LaunchItem")
      .select((eb) => [
        eb.fn.count("LaunchItem.id").$castTo<number>().as("count")
      ])
      .where("LaunchItem.launchId", "=", launchId)
      .where("LaunchItem.status", "=", "ACTIVE")
      .where("LaunchItem.onHoldBy", "=", userId)
      // .where("LaunchItem.onHoldUntil", ">=", currentDate)
      .where((eb) =>
        sql`${eb.ref(
          "LaunchItem.onHoldUntil"
        )} >= ${currentDate}`.$castTo<boolean>()
      )
      .executeTakeFirst();

    return result?.count;
  },

  // // Count long holds (items held for more than 2 minutes)
  // getLongHoldCountByLaunchIdAndUserId: async (
  //   db: Kysely<DB> | Transaction<DB>,
  //   launchId: string,
  //   userId: string
  // ) => {
  //   const result = await db
  //     .selectFrom("LaunchItem")
  //     .select((eb) => [
  //       eb.fn.count("LaunchItem.id").$castTo<number>().as("count")
  //     ])
  //     .where("LaunchItem.launchId", "=", launchId)
  //     .where("LaunchItem.status", "=", "ACTIVE")
  //     .where("LaunchItem.onHoldBy", "=", userId)
  //     .where(
  //       sql`${sql.ref(
  //         "onHoldUntil"
  //       )} > NOW() + INTERVAL '2 minutes'`.$castTo<boolean>()
  //     )
  //     .executeTakeFirst();

  //   return result?.count;
  // },
  // getSoldAndReservedItemCountByLaunchId: async (
  //   db: Kysely<DB> | Transaction<DB>,
  //   launchId: string
  // ) => {
  //   const result = await db
  //     .selectFrom("LaunchItem")
  //     .select((eb) => [eb.fn.countAll().$castTo<number>().as("count")])
  //     .where("LaunchItem.launchId", "=", launchId)
  //     .where((eb) =>
  //       eb.or([
  //         eb("LaunchItem.status", "in", ["RESERVED", "SOLD"]),
  //         sql`${sql.ref(
  //           "onHoldUntil"
  //         )} > NOW() + INTERVAL '1 minutes'`.$castTo<boolean>()
  //       ])
  //     )
  //     .executeTakeFirst();

  //   return result?.count || 0;
  // },
  bulkInsert: async (
    db: Kysely<DB> | Transaction<DB>,
    data: Insertable<LaunchItem>[]
  ) => {
    const launchItem = await db
      .insertInto("LaunchItem")
      .values(data)
      .returningAll()
      .execute();

    return launchItem;
  },
  getByLaunchIdAndStatus: async (
    launchId: string,
    status: LAUNCH_ITEM_STATUS
  ) => {
    const launchItems = await db
      .selectFrom("LaunchItem")
      .selectAll()
      .where("LaunchItem.launchId", "=", launchId)
      .where("LaunchItem.status", "=", status)
      .execute();

    return launchItems;
  },
  updateReservedLaunchItemStatusByLaunchId: async (
    launchId: string,
    status: LAUNCH_ITEM_STATUS
  ) => {
    const launchItem = await db
      .updateTable("LaunchItem")
      .returningAll()
      .set({ status: status })
      .where("LaunchItem.launchId", "=", launchId)
      .where("LaunchItem.status", "=", "RESERVED")
      .executeTakeFirstOrThrow(
        () => new Error("Couldnt update the launch item.")
      );

    return launchItem;
  },
  getActiveLaunchItemsWithCollectibleId: async (launchId: string) => {
    const nftIds = await db
      .selectFrom("LaunchItem")
      .innerJoin("Collectible", "Collectible.id", "LaunchItem.collectibleId")
      .select(["nftId"])
      .where("LaunchItem.status", "=", "ACTIVE")
      .where("LaunchItem.launchId", "=", launchId)
      .execute();

    return nftIds;
  }
};
