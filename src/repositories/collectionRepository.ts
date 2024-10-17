import { Insertable, Updateable } from "kysely";
import { db } from "../utils/db";
import { Collection } from "../types/db/types";

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

    return;
  },
};
