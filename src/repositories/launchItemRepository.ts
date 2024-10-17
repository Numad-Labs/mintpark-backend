import { Insertable, Updateable } from "kysely";
import { db } from "../utils/db";
import { LaunchItem } from "../types/db/types";

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
  update: async (id: string, data: Updateable<LaunchItem>) => {
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
};
