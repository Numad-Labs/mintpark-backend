import { Insertable } from "kysely";
import { db } from "../utils/db";
import { CollectibleTrait } from "../types/db/types";

export const collectibleTraitRepository = {
  bulkInsert: async (data: Insertable<CollectibleTrait>[]) => {
    const collectibleTraits = await db
      .insertInto("CollectibleTrait")
      .values(data)
      .returningAll()
      .execute();

    return collectibleTraits;
  },
  getByCollectibleId: async (collectibleId: string) => {
    const traits = await db
      .selectFrom("CollectibleTrait")
      .innerJoin("TraitValue", "TraitValue.id", "CollectibleTrait.traitValueId")
      .innerJoin("TraitType", "TraitType.id", "TraitValue.traitTypeId")
      .select(["CollectibleTrait.id", "TraitType.name", "TraitValue.value"])
      .where("CollectibleTrait.collectibleId", "=", collectibleId)
      .execute();
    return traits;
  }
  // getByCollectionId: async (collectionId: string) => {
  //   const traits = await db
  //     .selectFrom("CollectibleTrait")
  //     .innerJoin("Trait", "Trait.id", "CollectibleTrait.traitId")
  //     .innerJoin(
  //       "Collectible",
  //       "Collectible.id",
  //       "CollectibleTrait.collectibleId"
  //     )
  //     .innerJoin("Collection", "Collection.id", "Collectible.collectionId")
  //     .select(["Trait.id", "Trait.name"])
  //     .where("Collection.id", "=", collectionId)
  //     .distinctOn("Trait.name")
  //     .execute();
  //   return traits;
  // },
  // getByTraitIAndCollectionId: async (traitId: string, collectionId: string) => {
  //   const traits = await db
  //     .selectFrom("CollectibleTrait")
  //     .innerJoin("Trait", "Trait.id", "CollectibleTrait.traitId")
  //     .innerJoin(
  //       "Collectible",
  //       "Collectible.id",
  //       "CollectibleTrait.collectibleId"
  //     )
  //     .innerJoin("Collection", "Collection.id", "Collectible.collectionId")
  //     .select([
  //       "CollectibleTrait.id",
  //       "CollectibleTrait.value",
  //       "CollectibleTrait.rarity",
  //       "CollectibleTrait.traitId",
  //       "Trait.name",
  //     ])
  //     .where("Collection.id", "=", collectionId)
  //     .where("Trait.id", "=", traitId)
  //     .distinctOn("CollectibleTrait.value")
  //     .execute();
  //   return traits;
  // },
};
