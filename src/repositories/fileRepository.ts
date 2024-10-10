import { Insertable, Kysely, Updateable } from "kysely";
import { File } from "../types/db/types";
import { db } from "../utils/db";
export const fileRepository = {
  create: async (data: Insertable<File>) => {
    const file = await db
      .insertInto("File")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow(() => new Error("Could not create the file."));

    return file;
  },
  update: async (id: string, data: Updateable<File>) => {
    const file = await db
      .updateTable("File")
      .set(data)
      .where("File.id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow(() => new Error("Could not update the file."));

    return file;
  },
  getById: async (id: string) => {
    const file = await db
      .selectFrom("File")
      .selectAll()
      .where("File.id", "=", id)
      .executeTakeFirst();

    return file;
  },
  getByCollectionId: async (collectionId: string) => {
    const files = await db
      .selectFrom("File")
      .selectAll()
      .where("File.collection_id", "=", collectionId)
      .execute();

    return files;
  },
  getPendingFilesByCollectionId: async (collectionId: string) => {
    const files = await db
      .selectFrom("File")
      .selectAll()
      .where("File.collection_id", "=", collectionId)
      .where("File.status", "=", "PENDING")
      .execute();

    return files;
  },
  delete: async (id: string) => {
    const file = await db
      .deleteFrom("File")
      .where("File.id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow(() => new Error("Could not delete the file."));

    return file;
  },
  deleteByCollectionId: async (collectionId: string) => {
    const files = await db
      .deleteFrom("File")
      .where("File.collection_id", "=", collectionId)
      .returningAll()
      .execute();

    return files;
  },
};
