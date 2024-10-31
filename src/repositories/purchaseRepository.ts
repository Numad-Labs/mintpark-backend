import { Updateable, Insertable } from "kysely";
import { Purchase } from "../types/db/types";
import { db } from "../utils/db";

export const purchaseRepository = {
  create: async (data: Insertable<Purchase>) => {
    const purchase = await db
      .insertInto("Purchase")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow(() => new Error("Couldnt create the purchase."));

    return purchase;
  },
  update: async (id: string, data: Updateable<Purchase>) => {
    const purchase = await db
      .updateTable("Purchase")
      .returningAll()
      .set(data)
      .where("Purchase.id", "=", id)
      .executeTakeFirstOrThrow(() => new Error("Couldnt update the purchase."));

    return purchase;
  },
  delete: async (id: string) => {
    const purchase = await db
      .deleteFrom("Purchase")
      .returningAll()
      .where("Purchase.id", "=", id)
      .executeTakeFirstOrThrow(() => new Error("Couldnt delete the purchase."));

    return purchase;
  },
  getById: async (id: string) => {
    const purchase = await db
      .selectFrom("Purchase")
      .selectAll()
      .where("Purchase.id", "=", id)
      .executeTakeFirst();

    return purchase;
  },
  getByUserId: async (userId: string) => {
    const purchases = await db
      .selectFrom("Purchase")
      .selectAll()
      .where("Purchase.userId", "=", userId)
      .execute();

    return purchases;
  },
  getByLaunchId: async (launchId: string) => {
    const purchases = await db
      .selectFrom("Purchase")
      .innerJoin("LaunchItem", "Purchase.launchItemId", "LaunchItem.id")
      .innerJoin("Launch", "LaunchItem.launchId", "Launch.id")
      .selectAll()
      .where("Launch.id", "=", launchId)
      .execute();

    return purchases;
  },
  getCountByUserIdAndLaunchId: async (launchId: string, userId: string) => {
    const result = await db
      .selectFrom("Purchase")
      .innerJoin("LaunchItem", "Purchase.launchItemId", "LaunchItem.id")
      .innerJoin("Launch", "LaunchItem.launchId", "Launch.id")
      .select((eb) => [eb.fn.countAll().$castTo<number>().as("count")])
      .where("Launch.id", "=", launchId)
      .where("Purchase.userId", "=", userId)
      .executeTakeFirst();

    return result?.count;
  },
};
