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
};
