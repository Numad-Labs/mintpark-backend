import {
  collectionRepository,
  LaunchQueryParams,
} from "../repositories/collectionRepository";
import { uploadToS3 } from "../utils/aws";
import { randomUUID } from "crypto";
import { userRepository } from "../repositories/userRepository";
import { CollectionQueryParams } from "../controllers/collectionController";
import { layerRepository } from "../repositories/layerRepository";
import { CustomError } from "../exceptions/CustomError";
import { EVM_CONFIG } from "../../blockchain/evm/evm-config";
import NFTService from "../../blockchain/evm/services/nftService";
import MarketplaceService from "../../blockchain/evm/services/marketplaceService";
import { EVMCollectibleService } from "../../blockchain/evm/services/evmIndexService";
import { db } from "../utils/db";

const nftService = new NFTService(
  EVM_CONFIG.RPC_URL,
  EVM_CONFIG.MARKETPLACE_ADDRESS,
  new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS)
);

const evmCollectibleService = new EVMCollectibleService(EVM_CONFIG.RPC_URL!);

export const collectionServices = {
  create: async (
    data: any,
    issuerId: string,
    name: string,
    priceForLaunchpad: number,
    file?: Express.Multer.File
  ) => {
    const user = await userRepository.getById(issuerId);
    if (!user || !user.layerId) throw new CustomError("User not found.", 400);

    const layer = await layerRepository.getById(user.layerId);
    if (!layer) throw new CustomError("User not found.", 400);

    data.layerId = user.layerId;

    /*
      if user.layer is citrea, generate hex to deploy contract

      return that hex with the createdCollection
    */

    if (
      (layer.layer !== "CITREA" && layer.layer !== "FRACTAL") ||
      layer.network !== "TESTNET"
    )
      throw new CustomError("This layer is unsupported for now.", 400);

    let deployContractTxHex = null;
    if (layer.layer === "CITREA" && layer.network === "TESTNET") {
      const unsignedTx = await nftService.getUnsignedDeploymentTransaction(
        user.address,
        name,
        name,
        priceForLaunchpad
      );
      deployContractTxHex = JSON.parse(
        JSON.stringify(unsignedTx, (_, value) =>
          typeof value === "bigint" ? value.toString() : value
        )
      );
    }

    if (file) {
      const key = randomUUID();
      await uploadToS3(key, file);
      data.logoKey = key;
    }
    const collection = await collectionRepository.create(data);

    return { collection, deployContractTxHex };
  },
  update: async (id: string, data: any) => {
    const collection = await collectionRepository.update(db, id, data);

    return collection;
  },
  delete: async (id: string) => {
    const collection = await collectionRepository.delete(id);

    return collection;
  },
  getById: async (id: string) => {
    const collection = await collectionRepository.getById(db, id);

    return collection;
  },
  getAllLaunchedCollectionsByLayerId: async (params: LaunchQueryParams) => {
    const collections =
      await collectionRepository.getAllLaunchedCollectionsByLayerId(params);

    return collections;
  },
  getLaunchedCollectionById: async (id: string) => {
    const collection = await collectionRepository.getLaunchedCollectionById(id);

    return collection;
  },
  getListedCollections: async (params: CollectionQueryParams) => {
    const collections = await collectionRepository.getListedCollections(params);

    // Fetch owner counts for all collections in parallel
    const collectionsWithOwners = await Promise.all(
      collections.map(async (collection) => {
        try {
          if (collection.contractAddress) {
            const totalOwnerCount =
              await evmCollectibleService.getCollectionOwnersCount(
                collection.contractAddress
              );

            return {
              ...collection,
              totalOwnerCount,
            };
          } else {
            return {
              ...collection,
              totalOwnerCount: 0,
            };
          }
        } catch (error) {
          console.error(
            `Failed to fetch owner count for collection ${collection.id}:`,
            error
          );
          // Return 0 or null if we fail to fetch the count
          return {
            ...collection,
            totalOwnerCount: 0,
          };
        }
      })
    );
    return collectionsWithOwners;
  },
};
