import { db } from "../utils/db";

export const collectibleTraitRepository = {
  getByCollectibleId: async (collectibleId: string) => {
    const traits = await db
      .selectFrom("CollectibleTrait")
      .innerJoin("Trait", "Trait.id", "CollectibleTrait.traitId")
      .select([
        "CollectibleTrait.id",
        "Trait.name",
        "CollectibleTrait.value",
        "CollectibleTrait.rarity",
        "CollectibleTrait.collectibleId",
      ])
      .execute();

    return traits;
  },
  getByCollectionId: async (collectionId: string) => {
    const traits = await db
      .selectFrom("CollectibleTrait")
      .innerJoin("Trait", "Trait.id", "CollectibleTrait.traitId")
      .innerJoin(
        "Collectible",
        "Collectible.id",
        "CollectibleTrait.collectibleId"
      )
      .innerJoin("Collection", "Collection.id", "Collectible.collectionId")
      .select(["Trait.id", "Trait.name"])
      .where("Collection.id", "=", collectionId)
      .distinctOn("Trait.name")
      .execute();

    return traits;
  },
  getByTraitIAndCollectionId: async (traitId: string, collectionId: string) => {
    const traits = await db
      .selectFrom("CollectibleTrait")
      .innerJoin("Trait", "Trait.id", "CollectibleTrait.traitId")
      .innerJoin(
        "Collectible",
        "Collectible.id",
        "CollectibleTrait.collectibleId"
      )
      .innerJoin("Collection", "Collection.id", "Collectible.collectionId")
      .select([
        "CollectibleTrait.id",
        "CollectibleTrait.value",
        "CollectibleTrait.rarity",
        "CollectibleTrait.traitId",
        "Trait.name",
      ])
      .where("Collection.id", "=", collectionId)
      .where("Trait.id", "=", traitId)
      .distinctOn("CollectibleTrait.value")
      .execute();

    return traits;
  },
};
