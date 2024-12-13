import { Insertable, sql, Updateable } from "kysely";
import { TraitValue } from "../types/db/types";
import { db } from "../utils/db";

export const traitValueRepository = {
  bulkInsert: async (data: Insertable<TraitValue>[]) => {
    const traitValue = await db
      .insertInto("TraitValue")
      .values(data)
      .returningAll()
      .execute();

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
  getByCollectionId: async (collectionId: string) => {
    const traitValues = await db
      .selectFrom("TraitValue")
      .innerJoin("TraitType", "TraitType.id", "TraitValue.traitTypeId")
      .select(["TraitValue.id"])
      .where("TraitType.collectionId", "=", collectionId)
      .execute();

    return traitValues;
  },
  getById: async (id: string) => {
    const traitValue = await db
      .selectFrom("TraitValue")
      .selectAll()
      .where("TraitValue.id", "=", id)
      .executeTakeFirst();

    return traitValue;
  },
  updateById: async (id: string, data: Updateable<TraitValue>) => {
    const traitValue = await db
      .updateTable("TraitValue")
      .set(data)
      .returningAll()
      .where("TraitValue.id", "=", id)
      .executeTakeFirstOrThrow(
        () => new Error("Could not update the traitValue.")
      );

    return traitValue;
  },
};
