import { Insertable, sql } from "kysely";
import { Airdrop } from "../types/db/types";
import { db } from "../utils/db";

export const airdropRepository = {
  bulkInsert: async (data: Insertable<Airdrop>[]) => {
    const airdrop = await db
      .insertInto("Airdrop")
      .values(data)
      .returningAll()
      .executeTakeFirst();

    return airdrop;
  },
  getByAddress: async (address: string) => {
    const airdrop = await db
      .selectFrom("Airdrop")
      .selectAll()
      .where(sql`LOWER("Airdrop"."address")`, "=", sql`LOWER(${address})`)
      .executeTakeFirst();

    return airdrop;
  }
};
