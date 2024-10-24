import { getInscriptionUtxosByAddress } from "../../blockchain/utxo/fractal/libs";
import {
  CollectibleQueryParams,
  traitFilter,
} from "../controllers/collectibleController";
import { CustomError } from "../exceptions/CustomError";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { collectionRepository } from "../repositories/collectionRepository";
import { layerRepository } from "../repositories/layerRepository";
import { listRepository } from "../repositories/listRepository";
import { userRepository } from "../repositories/userRepository";
import { EVMCollectibleService } from "../../blockchain/evm/services/evmIndexService";
import { EVM_CONFIG } from "../../blockchain/evm/evm-config";
const evmCollectibleService = new EVMCollectibleService(EVM_CONFIG.RPC_URL!);

export const collectibleServices = {
  getListableCollectibles: async (
    userId: string,
    params: CollectibleQueryParams
  ) => {
    const user = await userRepository.getById(userId);
    if (!user || !user.layerId) throw new CustomError("User not found.", 400);

    const layerType = await layerRepository.getById(user.layerId!);
    if (!layerType) throw new Error("Layer not found.");

    const uniqueIdxs: string[] = [];

    if (layerType.layer === "CITREA" && layerType.network === "TESTNET") {
      const evmCollectibleService = new EVMCollectibleService(
        EVM_CONFIG.RPC_URL
      );

      const collections = await collectionRepository.getCollectionsByLayer(
        "CITREA"
      );

      console.log(`citrea collections: ${collections}`);

      for (const collection of collections) {
        if (!collection.contractAddress) continue;
        console.log(collection.contractAddress);
        const tokenIds = await evmCollectibleService.getOwnedTokens(
          collection.contractAddress,
          user.address
        );

        console.log(`tokenIds: ${tokenIds}`);

        if (!tokenIds || tokenIds.length === 0) continue;

        for (const tokenId of tokenIds)
          uniqueIdxs.push(`${collection.contractAddress}i${tokenId}`);
      }
    } else if (layerType.layer === "FRACTAL") {
      const inscriptionUtxos = await getInscriptionUtxosByAddress(
        user.address,
        true
      );

      inscriptionUtxos.map((inscriptionUtxo) => {
        inscriptionUtxo.inscriptions[0].inscriptionId;
        uniqueIdxs.push(inscriptionUtxo.inscriptions[0].inscriptionId);
      });
    }

    console.log(`uniqueIdxs after ${uniqueIdxs}`);

    if (uniqueIdxs.length === 0)
      return {
        collectibles: [],
        totalCount: 0,
        listCount: 0,
        collections: [],
      };

    const [
      listableCollectibles,
      totalCountResult,
      listedCountResult,
      collections,
    ] = await Promise.all([
      collectibleRepository.getListableCollectiblesByInscriptionIds(
        uniqueIdxs,
        params,
        user.id
      ),
      collectibleRepository.getListableCollectiblesCountByInscriptionIds(
        uniqueIdxs
      ),
      listRepository.getActiveListCountByUserId(userId),
      collectionRepository.getListedCollectionsWithCollectibleCountByInscriptionIds(
        uniqueIdxs
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
    params: CollectibleQueryParams
  ) => {
    let traitFilters: traitFilter[] = [];
    if (params.traits)
      traitFilters = params.traits.map((trait) => {
        const [name, value] = trait.split(":");
        return { name, value };
      });

    const [listableCollectibles, countResult] = await Promise.all([
      collectibleRepository.getListableCollectiblesByCollectionId(
        collectionId,
        params,
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
