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
import { TransactionConfirmationService } from "../../blockchain/evm/services/transactionConfirmationService";
import { orderRepository } from "../repositories/orderRepostory";

const evmCollectibleService = new EVMCollectibleService(EVM_CONFIG.RPC_URL!);
const confirmationService = new TransactionConfirmationService(
  EVM_CONFIG.RPC_URL!
);

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

      if (collections?.length) {
        console.log(`Found ${collections.length} CITREA collections`);

        // Filter valid collections and process them in parallel
        const validCollections = collections.filter((c) => c.contractAddress);
        const tokenResults = await Promise.all(
          validCollections.map(async (collection) => {
            try {
              const tokenIds = await evmCollectibleService.getOwnedTokens(
                collection.contractAddress!,
                user.address
              );

              if (!tokenIds?.length) return [];

              console.log(
                `Found ${tokenIds.length} tokens for contract: ${collection.contractAddress}`
              );
              return tokenIds.map(
                (tokenId) => `${collection.contractAddress}i${tokenId}`
              );
            } catch (error) {
              console.error(
                `Error processing collection ${collection.contractAddress}:`,
                error
              );
              return [];
            }
          })
        );

        uniqueIdxs.push(...tokenResults.flat());
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

  getActivityByCollectibleId: async (collectibleId: string) => {
    const collectible = await collectibleRepository.getById(collectibleId);
    if (!collectible) throw new Error("collectible not found.");

    const collection = await collectionRepository.getById(
      collectible.collectionId
    );
    if (!collection) throw new CustomError("collection not found.", 400);

    if (!collection.contractAddress)
      throw new CustomError("contractAddress not found", 400);

    const order = await orderRepository.getByCollectionId(collection.id);
    if (!order) throw new CustomError("order not found.", 400);

    if (!order.txId) throw new CustomError("txid not found in order.", 400);
    const collectionAddress = collectible.uniqueIdx.split("i")[0];
    const tokenId = collectible.uniqueIdx.split("i")[1];

    const transactionDetail = await confirmationService.getTransactionDetails(
      order.txId
    );

    const activities = await evmCollectibleService.getActivityByTokenId(
      collection.contractAddress,
      tokenId,
      transactionDetail.blockNumber
    );
    return activities;
  },
};
