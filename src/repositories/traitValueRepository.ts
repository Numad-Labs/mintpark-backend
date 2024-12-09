import { Insertable, sql } from "kysely";
import { TraitValue } from "../types/db/types";
import { db } from "../utils/db";

export const traitValueRepository = {
  create: async (data: Insertable<TraitValue>) => {
    const traitValue = await db
      .insertInto("TraitValue")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow(
        () => new Error("Couldn't create the trait value.")
      );

    return traitValue;
  },
  getByNameValueAndCollectionId: async (
    name: string,
    value: string,
    collectionId: string
  ) => {
    const traitValue = await db
      .selectFrom("TraitValue")
      .innerJoin("TraitType", "TraitType.id", "TraitValue.traitTypeId")
      .select(["TraitValue.id"])
      .where("TraitType.collectionId", "=", collectionId)
      .where(sql`lower("TraitType"."name") = lower(${name})`.$castTo<boolean>())
      .where(
        sql`lower("TraitValue"."value") = lower(${value})`.$castTo<boolean>()
      )
      .executeTakeFirst();

    return traitValue;
  },
};
