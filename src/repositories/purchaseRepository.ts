import { Insertable } from "kysely";
import { Purchase } from "../types/db/types";
import { db } from "../utils/db";

export const purchaseRepository = {
  create: async (data: Insertable<Purchase>) => {
    const purchase = await db
      .insertInto("Purchase")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow(
        () => new Error("Could not create the purchase.")
      );

    return purchase;
  },
  getPurchaseCountByAddress: async (userId: string, collectionId: string) => {
    const result = await db
      .selectFrom("Purchase")
      .innerJoin("Collectible", "Collectible.id", "Purchase.collectibleId")
      .innerJoin("Collection", "Collection.id", "Collectible.collectionId")
      .select(({ fn }) => [fn.count<number>("Purchase.buyerId").as("count")])
      .where("Collection.id", "=", collectionId)
      .where("Purchase.buyerId", "=", userId)
      .executeTakeFirstOrThrow(() => new Error("Error on purchaseCount."));

    return result.count;
  },
};
