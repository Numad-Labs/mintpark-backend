import { getInscriptionUtxosByAddress } from "../../blockchain/utxo/fractal/libs";
import {
  CollectibleQueryParams,
  traitFilter,
} from "../controllers/collectibleController";
import { CustomError } from "../exceptions/CustomError";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { collectionRepository } from "../repositories/collectionRepository";
import { listRepository } from "../repositories/listRepository";
import { userRepository } from "../repositories/userRepository";

export const collectibleServices = {
  getListableCollectibles: async (
    userId: string,
    params: CollectibleQueryParams
  ) => {
    const user = await userRepository.getById(userId);
    if (!user) throw new CustomError("User not found.", 400);

    const inscriptionUtxos = await getInscriptionUtxosByAddress(
      user.address,
      true
    );
    const inscriptionIds = inscriptionUtxos.map(
      (inscriptionUtxo) => inscriptionUtxo.inscriptions[0].inscriptionId
    );

    const [
      listableCollectibles,
      totalCountResult,
      listedCountResult,
      collections,
    ] = await Promise.all([
      collectibleRepository.getListableCollectiblesByInscriptionIds(
        inscriptionIds,
        params
      ),
      collectibleRepository.getListableCollectiblesCountByInscriptionIds(
        inscriptionIds
      ),
      listRepository.getActiveListCountByUserId(userId),
      collectionRepository.getListedCollectionsWithCollectibleCountByInscriptionIds(
        inscriptionIds
      ),
    ]);

    const listedCount = Number(listedCountResult?.activeListCount ?? 0);
    const totalCount = Number(totalCountResult?.count ?? 0) + listedCount;

    return {
      collectibles: listableCollectibles,
      totalCount: totalCount,
      listCount: listedCount,
      collections,
    };
  },
  getListableCollectiblesByCollectionId: async (
    collectionId: string,
    isListed: boolean,
    traits?: string[]
  ) => {
    let traitFilters: traitFilter[] = [];
    if (traits)
      traitFilters = traits.map((trait) => {
        const [name, value] = trait.split(":");
        return { name, value };
      });

    const [listableCollectibles, countResult] = await Promise.all([
      collectibleRepository.getListableCollectiblesByCollectionId(
        collectionId,
        isListed,
        traitFilters
      ),
      listRepository.getActiveListCountByCollectionid(collectionId),
    ]);

    return {
      listableCollectibles,
      activeListCount: countResult?.activeListCount ?? 0,
    };
  },
};
