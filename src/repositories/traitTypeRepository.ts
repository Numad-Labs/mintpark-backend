import { Insertable, sql } from "kysely";
import { TraitType } from "../types/db/types";
import { db } from "../utils/db";

export const traitTypeRepository = {
  bulkInsert: async (data: Insertable<TraitType>[]) => {
    const traitType = await db
      .insertInto("TraitType")
      .values(data)
      .returningAll()
      .execute();

    return traitType;
  },
  getByNameAndCollectionId: async (name: string, collectionId: string) => {
    const traitType = await db
      .selectFrom("TraitType")
      .selectAll()
      .where("TraitType.collectionId", "=", collectionId)
      .where(sql`lower("TraitType"."name") = lower(${name})`.$castTo<boolean>())
      .executeTakeFirst();

    return traitType;
  },
  getTraitTypesByCollectionId: async (collectionId: string) => {
    const traitType = await db
      .selectFrom("TraitType")
      .selectAll()
      .where("TraitType.collectionId", "=", collectionId)
      .execute();

    return traitType;
  }
};
