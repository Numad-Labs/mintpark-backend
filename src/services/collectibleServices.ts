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
    console.log("🚀 ~      params.collectionIds:", params.collectionIds);

    const user = await userRepository.getById(userId);
    if (!user) throw new CustomError("User not found.", 400);

    const layerType = await layerRepository.getById(user.layerId!);
    if (!layerType) throw new Error("Layer not found.");

    if (layerType.layer === "CITREA" && layerType.network === "TESTNET") {
      const evmCollectibleService = new EVMCollectibleService(
        EVM_CONFIG.RPC_URL
      );

      try {
        // const testIds = ["8e06eae2-e1d4-47e7-9196-71747a1851c1"];
        // const testAddress = "0xd6721C1fAC8417D031D7eC7D6cF804446D3BdCDe";
        // Get collections
        const collections = await evmCollectibleService.getEVMCollections(
          params.collectionIds
        );
        console.log("🚀 ~ collections:", collections);

        // Process collections in parallel
        const collectiblesPromise = collections.map(async (collection) => {
          if (!collection.contractAddress) return [];

          try {
            const tokenIds = await evmCollectibleService.getOwnedTokens(
              collection.contractAddress,
              // testAddress,
              user.address
            );
            console.log("🚀 ~ collectiblesPromise ~ tokenIds:", tokenIds);

            if (!tokenIds) return [];
            if (tokenIds.length === 0) return [];

            return await collectibleRepository.getListableCollectiblesByInscriptionIds(
              tokenIds,
              params,
              user.id,
              collection.id
            );
          } catch (error) {
            console.error(
              `Failed to fetch collectibles for collection ${collection.id}:`,
              error
            );
            return [];
          }
        });

        const collectiblesArrays = await Promise.all(collectiblesPromise);
        const listableCollectibles = collectiblesArrays.flat();

        const [totalCountResult, listedCountResult] = await Promise.all([
          collectibleRepository.getListableCollectiblesCountByCollections(
            collections.map((c) => c.id)
            // user.id
          ),
          listRepository.getActiveListCountByUserId(userId),
        ]);

        const listedCount = Number(listedCountResult?.activeListCount ?? 0);
        const totalCount = Number(totalCountResult?.count ?? 0) + listedCount;

        return {
          collectibles: listableCollectibles,
          totalCount,
          listCount: listedCount,
          collections,
        };
      } catch (error) {
        console.error("Error in getListableCollectibles:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to fetch collectibles", 500);
      }
    }
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
