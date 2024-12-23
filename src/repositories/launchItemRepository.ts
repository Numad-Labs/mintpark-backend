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
  getById: async (id: string) => {
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
  getRandomItemByLauchId: async (launchId: string) => {
    const launchItem = await db
      .selectFrom("LaunchItem")
      .selectAll()
      .where("LaunchItem.launchId", "=", launchId)
      .where("LaunchItem.status", "=", "ACTIVE")
      .where((eb) =>
        eb.or([
          eb("LaunchItem.onHoldUntil", "is", null),
          sql`${eb.ref(
            "onHoldUntil"
          )} < NOW() - INTERVAL '1 minute'`.$castTo<boolean>(),
        ])
      )
      .orderBy(sql`RANDOM()`)
      .limit(1)
      .executeTakeFirstOrThrow(
        () => new Error("Please try again. No available launch item was found.")
      );

    return launchItem;
  },
  setOnHoldById: async (
    db: Kysely<DB> | Transaction<DB>,
    id: string,
    buyerId: string
  ) => {
    const launchItem = await db
      .updateTable("LaunchItem")
      .set({ onHoldUntil: sql`NOW()`, onHoldBy: buyerId })
      .returningAll()
      .where("LaunchItem.id", "=", id)
      .where("LaunchItem.status", "=", "ACTIVE")
      .where((eb) =>
        eb.or([
          eb("LaunchItem.onHoldUntil", "is", null),
          sql`${eb.ref(
            "onHoldUntil"
          )} < NOW() - INTERVAL '1 minute'`.$castTo<boolean>(),
        ])
      )
      .executeTakeFirstOrThrow(
        () =>
          new Error("Please try again. Could not set the launch item on hold.")
      );

    return launchItem;
  },
  getOnHoldById: async (id: string) => {
    const launchItem = await db
      .selectFrom("LaunchItem")
      .selectAll()
      .where("LaunchItem.id", "=", id)
      .where("LaunchItem.status", "=", "ACTIVE")
      .where((eb) =>
        sql`${eb.ref(
          "onHoldUntil"
        )} < NOW() - INTERVAL '1 minute'`.$castTo<boolean>()
      )
      .executeTakeFirst();

    return launchItem;
  },
  getOnHoldCountByLaunchIdAndUserId: async (
    launchId: string,
    userId: string
  ) => {
    const result = await db
      .selectFrom("LaunchItem")
      .select((eb) => [eb.fn.countAll().$castTo<number>().as("count")])
      .where("LaunchItem.launchId", "=", launchId)
      .where("LaunchItem.status", "=", "ACTIVE")
      .where("LaunchItem.onHoldBy", "=", userId)
      .where((eb) =>
        sql`${eb.ref(
          "onHoldUntil"
        )} < NOW() - INTERVAL '2 minute'`.$castTo<boolean>()
      )
      .executeTakeFirst();

    return result?.count;
  },
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
};
