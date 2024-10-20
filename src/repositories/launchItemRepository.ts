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
  getByCollectionId: async (collectionId: string) => {
    const launchItems = await db
      .selectFrom("LaunchItem")
      .innerJoin("Launch", "LaunchItem.launchId", "Launch.id")
      .innerJoin("Collection", "Launch.collectionId", "Collection.id")
      .select([
        "LaunchItem.id",
        "LaunchItem.launchId",
        "LaunchItem.fileKey",
        "LaunchItem.metadata",
        "LaunchItem.status",
        "Launch.id as launchId",
        "Launch.collectionId as collectionId",
        "Collection.name as collectionName",
        "Collection.creator as collectionCreator",
        "Collection.description as collectionDescription",
        "Collection.logoKey as collectionLogoKey",
        "Collection.layerId as layerId",
      ])
      .where("Launch.collectionId", "=", collectionId)
      .execute();

    return launchItems;
  },
  getActiveLaunchItems: async (collectionId: string) => {
    const launchItems = await db
      .selectFrom("LaunchItem")
      .innerJoin("Launch", "LaunchItem.launchId", "Launch.id")
      .innerJoin("Collection", "Launch.collectionId", "Collection.id")
      .select([
        "LaunchItem.id",
        "LaunchItem.launchId",
        "LaunchItem.fileKey",
        "LaunchItem.metadata",
        "LaunchItem.status",
        "Launch.id as launchId",
        "Launch.collectionId as collectionId",
        "Collection.name as collectionName",
        "Collection.creator as collectionCreator",
        "Collection.description as collectionDescription",
        "Collection.logoKey as collectionLogoKey",
        "Collection.layerId as layerId",
      ])
      .where("Launch.collectionId", "=", collectionId)
      .where("LaunchItem.status", "=", "ACTIVE")
      .execute();

    return launchItems;
  },
};
