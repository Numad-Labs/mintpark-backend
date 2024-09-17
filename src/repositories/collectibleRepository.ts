import { Insertable, Kysely, Transaction, Updateable } from "kysely";
import { Collectible, DB } from "../types/db/types";
import { db } from "../utils/db";
import { COLLECTIBLE_STATUS } from "../types/db/enums";

export const collectibleRepository = {
  create: async (
    data: Insertable<Collectible>[],
    db: Kysely<DB> | Transaction<DB>
  ) => {
    const collectible = await db
      .insertInto("Collectible")
      .values(data)
      .returningAll()
      .execute();

    return collectible;
  },
  getById: async (id: string) => {
    const collectible = await db
      .selectFrom("Collectible")
      .selectAll()
      .where("Collectible.id", "=", id)
      .executeTakeFirst();

    return collectible;
  },
  getByCollectionId: async (collectionId: string) => {
    const collectibles = await db
      .selectFrom("Collectible")
      .selectAll()
      .where("Collectible.collectionId", "=", collectionId)
      .execute();

    return collectibles;
  },
  getAvailablesByCollectionId: async (collectionId: string) => {
    const collectibles = await db
      .selectFrom("Collectible")
      .selectAll()
      .where("Collectible.collectionId", "=", collectionId)
      .where("Collectible.status", "=", "ACTIVE")
      .execute();

    return collectibles;
  },
  update: async (id: string, data: Updateable<Collectible>) => {
    const collectible = await db
      .updateTable("Collectible")
      .set(data)
      .where("Collectible.id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow(
        () => new Error("Could not update the collectible.")
      );

    return collectible;
  },
  updateExpiredOnHoldCollectibles: async (currentDate: Date) => {
    const collectibles = await db
      .updateTable("Collectible")
      .set({ status: "ACTIVE" })
      .where("Collectible.status", "=", "ON_HOLD")
      .where("Collectible.onHoldUntil", "<", currentDate)
      .execute();

    return collectibles;
  },
};
