import {
  collectionRepository,
  LaunchQueryParams,
} from "../repositories/collectionRepository";
import { deleteFromS3, uploadToS3 } from "../utils/aws";
import { randomUUID } from "crypto";
import { userRepository } from "../repositories/userRepository";
import {
  CollectionQueryParams,
  updateCollection,
} from "../controllers/collectionController";
import { layerRepository } from "../repositories/layerRepository";
import { CustomError } from "../exceptions/CustomError";
import { EVM_CONFIG } from "../../blockchain/evm/evm-config";
import NFTService from "../../blockchain/evm/services/nftService";
import MarketplaceService from "../../blockchain/evm/services/marketplaceService";
import { EVMCollectibleService } from "../../blockchain/evm/services/evmIndexService";
import { db } from "../utils/db";
import { Insertable, Updateable } from "kysely";
import { Collection } from "../types/db/types";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { layerServices } from "./layerServices";
import { serializeBigInt } from "../../blockchain/evm/utils";
import { config } from "../config/config";

const nftService = new NFTService(
  EVM_CONFIG.RPC_URL,
  EVM_CONFIG.MARKETPLACE_ADDRESS,
  new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS)
);

const evmCollectibleService = new EVMCollectibleService(EVM_CONFIG.RPC_URL!);

export const collectionServices = {
  create: async (
    data: Insertable<Collection>,
    name: string,
    priceForLaunchpad: number,
    file: Express.Multer.File,
    issuerId: string,
    userLayerId: string
  ) => {
    if (data.type === "SYNTHETIC")
      throw new CustomError(
        "You cannot directly create synthetic collection.",
        400
      );

    if (!data.layerId) throw new CustomError("Please provide a layerId.", 400);
    const layer = await layerServices.checkIfSupportedLayerOrThrow(
      data.layerId
    );

    const user = await userRepository.getByUserLayerId(userLayerId);
    if (!user) throw new CustomError("User not found.", 400);
    if (user.id !== issuerId)
      throw new CustomError(
        "You are not allowed to create for this user.",
        400
      );
    if (!user.isActive)
      throw new CustomError("This account is deactivated.", 400);
    if (user.layer !== layer.layer || user.network !== layer.network)
      throw new CustomError(
        "You cannot create collection for this layerId with the current active account.",
        400
      );

    let deployContractTxHex = null,
      ordinalCollection = null,
      l2Collection = null;

    if (user.layer === "CITREA" && user.network === "TESTNET") {
      const unsignedTx = await nftService.getUnsignedDeploymentTransaction(
        user.address,
        config.VAULT_ADDRESS,
        name
      );
      deployContractTxHex = serializeBigInt(unsignedTx);
    }

    const key = randomUUID();
    await uploadToS3(key, file);
    data.logoKey = key;

    if (data.type === "INSCRIPTION" || data.type === "RECURSIVE_INSCRIPTION") {
      const bitcoinLayer = await layerRepository.getBitcoin("TESTNET");

      ordinalCollection = await collectionRepository.create({
        ...data,
        status: "UNCONFIRMED",
        creatorId: user.id,
        layerId: bitcoinLayer.id,
        ownerCount: 0,
        // creatorUserLayerId: userLayerId,
      });

      l2Collection = await collectionRepository.create({
        ...data,
        type: "SYNTHETIC",
        status: "UNCONFIRMED",
        parentCollectionId: ordinalCollection.id,
        creatorId: user.id,
        creatorUserLayerId: userLayerId,
        ownerCount: 0,
      });
    } else if (data.type === "IPFS_CID" || data.type === "IPFS_FILE") {
      l2Collection = await collectionRepository.create({
        ...data,
        type: data.type,
        status: "UNCONFIRMED",
        creatorId: user.id,
        creatorUserLayerId: userLayerId,
        ownerCount: 0,
      });
    }

    return { ordinalCollection, l2Collection, deployContractTxHex };
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

    // // Fetch owner counts for all collections in parallel
    // const collectionsWithOwners = await Promise.all(
    //   collections.map(async (collection) => {
    //     try {
    //       if (collection.contractAddress) {
    //         const totalOwnerCount =
    //           await evmCollectibleService.getCollectionOwnersCount(
    //             collection.contractAddress
    //           );

    //         return {
    //           ...collection,
    //           totalOwnerCount,
    //         };
    //       } else {
    //         return {
    //           ...collection,
    //           totalOwnerCount: 0,
    //         };
    //       }
    //     } catch (error) {
    //       console.error(
    //         `Failed to fetch owner count for collection ${collection.id}:`,
    //         error
    //       );
    //       // Return 0 or null if we fail to fetch the count
    //       return {
    //         ...collection,
    //         totalOwnerCount: 0,
    //       };
    //     }
    //   })
    // );
    // return collectionsWithOwners;

    return collections;
  },
  // update: async (
  //   id: string,
  //   data: updateCollection,
  //   file: Express.Multer.File,
  //   issuerId: string
  // ) => {
  //   const issuer = await userRepository.getByIdWithLayer(issuerId);
  //   if (!issuer) throw new CustomError("User not found.", 400);

  //   const collection = await collectionRepository.getById(db, id);
  //   if (!collection) throw new CustomError("Collection not found.", 400);

  //   if (file && collection.logoKey) {
  //     await deleteFromS3(`collection/${collection.logoKey}`);
  //   }

  //   if (file) {
  //     const randomKey = randomUUID();
  //     await uploadToS3(`collection/${randomKey}`, file);

  //     data.logoKey = randomKey;
  //   }

  //   if (issuer.layer === "CITREA") {
  //     //update the data in the contract
  //   } else if (issuer.layer === "FRACTAL") {
  //     //update the collections REPO
  //   }

  //   const updatedCollection = await collectionRepository.update(db, id, data);

  //   return updatedCollection;
  // },
  // listForEvm: async (contractAddress: string, issuerId: string) => {
  //   const issuer = await userRepository.getByIdWithLayer(issuerId);
  //   if (!issuer) throw new CustomError("User not found.", 400);

  //   const isExistingCollection =
  //     await collectionRepository.getByContractAddress(contractAddress);
  //   if (isExistingCollection)
  //     throw new CustomError("This collection has already been listed.", 400);

  //   if (issuer.layer !== "CITREA")
  //     throw new CustomError("Unsupported layer for this API.", 400);

  //   //fetch nft details & insert them into the database
  //   let collectionData: any;
  //   const collection = await collectionRepository.create(collectionData);

  //   let collectibleData: any;
  //   const collectibles = await collectibleRepository.bulkInsert(
  //     collectibleData
  //   );

  //   return { collectionData, collectibleData };
  // },
};
