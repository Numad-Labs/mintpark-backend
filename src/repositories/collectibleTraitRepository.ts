import { Insertable } from "kysely";
import { db } from "../utils/db";
import { CollectibleTrait } from "../types/db/types";

export const collectibleTraitRepository = {
  getByCollectibleIdWithInscription: async (collectibleId: string) => {
    const traits = await db
      .selectFrom('CollectibleTrait')
      .innerJoin('TraitValue', 'TraitValue.id', 'CollectibleTrait.traitValueId')
      .innerJoin('TraitType', 'TraitType.id', 'TraitValue.traitTypeId')
      .select([
        'TraitType.name as traitType',
        'TraitValue.value as traitValue',
        'TraitType.zIndex',
        'TraitValue.inscriptionId'
      ])
      .where('CollectibleTrait.collectibleId', '=', collectibleId)
      .where('TraitValue.inscriptionId', 'is not', null)
      .orderBy('TraitType.zIndex', 'asc')
      .execute();

    return traits;
  },
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
  },
  getByCollectibleIdAndTraitValueId: async (
    collectibleId: string,
    traitValueId: string
  ) => {
    const trait = await db
      .selectFrom("CollectibleTrait")
      .select(["id"])
      .where("collectibleId", "=", collectibleId)
      .where("traitValueId", "=", traitValueId)
      .executeTakeFirst();
    return trait;
  },
  getCollectibleTraitsWithDetails: async (collectibleId: string) => {
    const traits = await db
      .selectFrom("CollectibleTrait")
      .innerJoin("TraitValue", "TraitValue.id", "CollectibleTrait.traitValueId")
      .innerJoin("TraitType", "TraitType.id", "TraitValue.traitTypeId")
      .innerJoin("Collection", "Collection.id", "TraitType.collectionId")
      .innerJoin(
        "Collectible",
        "Collectible.id",
        "CollectibleTrait.collectibleId"
      )
      .select([
        "CollectibleTrait.id",
        "TraitValue.id as traitValueId",
        "TraitValue.fileKey",
        "TraitValue.value",
        "TraitType.id as traitTypeId",
        "TraitType.name as traitTypeName",
        "TraitType.zIndex",
        "Collection.recursiveHeight",
        "Collection.recursiveWidth",
        "Collectible.isOOOEdition"
      ])
      .where("CollectibleTrait.collectibleId", "=", collectibleId)
      .orderBy("TraitType.zIndex", "asc")
      .execute();

    return traits.map((trait) => ({
      id: trait.id,
      traitValue: {
        id: trait.traitValueId,
        fileKey: trait.fileKey,
        value: trait.value,
        traitType: {
          id: trait.traitTypeId,
          name: trait.traitTypeName,
          zIndex: trait.zIndex
        }
      }
    }));
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
