import { sql } from "kysely";
import { db } from "../utils/db";

export const collectibleRepository = {
  getListableCollectibles: async (inscriptionIds: string[]) => {
    const collectibles = await db
      .selectFrom("Collectible")
      .selectAll()
      .where("Collectible.uniqueIdx", "in", inscriptionIds)
      .execute();

    return collectibles;
  },
};
