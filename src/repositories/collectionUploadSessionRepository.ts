import { CollectionUploadSession } from "@app-types/db/types";
import { db } from "@utils/db";
import { Insertable, sql } from "kysely";

export const collectionUploadSessionRepository = {
  create: async (data: Insertable<CollectionUploadSession>) => {
    const collectionUploadSession = await db
      .insertInto("CollectionUploadSession")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow(
        () => new Error("Could not create collectionUploadSession")
      );

    return collectionUploadSession;
  },
  getById: async (id: string) => {
    const collectionUploadSession = await db
      .selectFrom("CollectionUploadSession")
      .innerJoin(
        "Collection",
        "Collection.id",
        "CollectionUploadSession.collectionId"
      )
      .select([
        "CollectionUploadSession.collectionId",
        "CollectionUploadSession.expectedTraitTypes",
        "CollectionUploadSession.expectedTraitValues",
        "CollectionUploadSession.expectedRecursive",
        "CollectionUploadSession.expectedOOOEditions",
        "CollectionUploadSession.startedAt",

        // Count TraitTypes for the collection
        (eb) =>
          eb
            .selectFrom("TraitType")
            .select(sql<number>`count(*)`.as("traitTypeCount"))
            .whereRef("TraitType.collectionId", "=", "Collection.id")
            .as("traitTypeCount"),

        // Count TraitValues for the collection
        (eb) =>
          eb
            .selectFrom("TraitValue")
            .innerJoin("TraitType", "TraitValue.traitTypeId", "TraitType.id")
            .select(sql<number>`count(*)`.as("traitValueCount"))
            .whereRef("TraitType.collectionId", "=", "Collection.id")
            .as("traitValueCount"),

        // Count recursive collectible
        (eb) =>
          eb
            .selectFrom("Collectible")
            .select(sql<number>`count(*)`.as("recursiveCollectibleCount"))
            .whereRef("Collectible.collectionId", "=", "Collection.id")
            .where("Collectible.isOOOEdition", "=", false)
            .as("recursiveCollectibleCount"),

        // Count 1-of-1 edition collectibles
        (eb) =>
          eb
            .selectFrom("Collectible")
            .select(sql<number>`count(*)`.as("oooEditionCount"))
            .whereRef("Collectible.collectionId", "=", "Collection.id")
            .where("Collectible.isOOOEdition", "=", true)
            .as("oooEditionCount")
      ])
      .where("CollectionUploadSession.collectionId", "=", id)
      .executeTakeFirst();

    return collectionUploadSession;
  }
};
