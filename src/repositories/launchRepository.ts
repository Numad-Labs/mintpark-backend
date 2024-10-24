import { Insertable, Updateable } from "kysely";
import { db } from "../utils/db";
import { Launch } from "../types/db/types";

export const launchRepository = {
  create: async (data: Insertable<Launch>) => {
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
};
