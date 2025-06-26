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
  getTraitValueWithCollectionIdById: async (id: string) => {
    const traitValue = await db
      .selectFrom("TraitValue")
      .innerJoin("TraitType", "TraitType.id", "TraitValue.traitTypeId")
      .select(["TraitValue.id", "TraitType.collectionId"])
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
  getTraitValuesWithCountByTraitTypeId: async (traitTypeId: string) => {
    const traitValues = await db
      .selectFrom("TraitValue")
      .innerJoin(
        "CollectibleTrait",
        "CollectibleTrait.traitValueId",
        "TraitValue.id"
      )
      .innerJoin(
        "Collectible",
        "Collectible.id",
        "CollectibleTrait.collectibleId"
      )
      .select((eb) => [
        "TraitValue.id",
        "TraitValue.fileKey",
        "TraitValue.value",
        "TraitValue.createdAt",
        eb.fn.count("CollectibleTrait.id").as("collectibleTraitCount")
      ])
      .where("TraitValue.traitTypeId", "=", traitTypeId)
      .where("Collectible.status", "=", "CONFIRMED")
      .groupBy([
        "TraitValue.id",
        "TraitValue.fileKey",
        "TraitValue.value",
        "TraitValue.createdAt"
      ])
      .execute();

    return traitValues;
  },
  /**
   * Get count of trait values for a collection that do NOT have an inscriptionId (i.e. inscription still pending)
   */
  getNotDoneCountByCollectionId: async (collectionId: string) => {
    const result = await db
      .selectFrom("TraitValue")
      .innerJoin("TraitType", "TraitType.id", "TraitValue.traitTypeId")
      .select((eb) => eb.fn.count("TraitValue.id").as("count"))
      .where("TraitType.collectionId", "=", collectionId)
      .where("TraitValue.inscriptionId", "is", null)
      .executeTakeFirst();

    return Number(result?.count ?? 0);
  },

  getByTraitTypeIdAndValue: async (traitTypeId: string, value: string) => {
    const collectible = await db
      .selectFrom("TraitValue")
      .selectAll()
      .where("TraitValue.traitTypeId", "=", traitTypeId)
      .where("TraitValue.value", "=", value)
      .executeTakeFirst();

    return collectible;
  }
};
