import { Insertable, Kysely, Transaction, Updateable } from "kysely";
import { Collection, DB } from "../types/db/types";
import { db } from "../utils/db";
import { LAYER_TYPE } from "@prisma/client";

export const collectionRepository = {
  create: async (
    data: Insertable<Collection>,
    db: Kysely<DB> | Transaction<DB>
  ) => {
    const collection = await db
      .insertInto("Collection")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow(
        () => new Error("Could not create the collection.")
      );

    return collection;
  },
  update: async (id: string, data: Updateable<Collection>) => {
    const collection = await db
      .updateTable("Collection")
      .set(data)
      .where("Collection.id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow(
        () => new Error("Could not update the collection.")
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
  get: async () => {
    const collections = await db
      .selectFrom("Collection")
      .selectAll()
      .orderBy("Collection.createdAt desc")
      .execute();

    return collections;
  },
  getByOwnerAddress: async (ownerAddress: string) => {
    const collections = await db
      .selectFrom("Collection")
      .selectAll()
      .where("Collection.ownerAddress", "=", ownerAddress)
      .orderBy("Collection.createdAt desc")
      .execute();

    return collections;
  },
  getByLayerType: async (layerType: LAYER_TYPE) => {
    const collections = await db
      .selectFrom("Collection")
      .selectAll()
      .where("Collection.layer_type", "=", layerType)
      .orderBy("Collection.createdAt desc")
      .execute();

    return collections;
  },
};
