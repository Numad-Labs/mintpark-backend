import { ACTIVITY_TYPE } from "@app-types/db/enums";
import { PointActivity } from "@app-types/db/types";
import { CustomError } from "@exceptions/CustomError";
import { db } from "@utils/db";
import { Insertable, sql } from "kysely";

export const pointActivityRepository = {
  create: async (data: Insertable<PointActivity>) => {
    const activityType = await db
      .insertInto("PointActivity")
      .values(data)
      .returningAll()
      .executeTakeFirst();

    return activityType;
  },
  getBalanceByAddress: async (address: string) => {
    const result = await db
      .selectFrom("PointActivity")
      .innerJoin("UserLayer", "UserLayer.id", "PointActivity.userLayerId")
      .select(({ fn }) => [
        fn
          .coalesce(fn.sum("PointActivity.awardedPoints"), sql<number>`0`)
          .as("balance")
      ])
      .where(sql`LOWER("UserLayer"."address")`, "=", address.toLowerCase())
      .executeTakeFirst();

    if (!result) throw new CustomError("Balance not found", 400);

    return result.balance;
  }
};
