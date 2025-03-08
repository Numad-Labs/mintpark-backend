import {
  collectionRepository,
  LaunchQueryParams
} from "../repositories/collectionRepository";
import { deleteFromS3, uploadToS3 } from "../utils/aws";
import { randomUUID } from "crypto";
import { userRepository } from "../repositories/userRepository";
import {
  CollectionQueryParams,
  updateCollection
} from "../controllers/collectionController";
import { layerRepository } from "../repositories/layerRepository";
import { CustomError } from "../exceptions/CustomError";
import { EVM_CONFIG } from "../blockchain/evm/evm-config";
import { db } from "../utils/db";
import { Insertable, Updateable } from "kysely";
import { Collection } from "../types/db/types";
import { layerServices } from "./layerServices";
import { generateSymbol, serializeBigInt } from "../blockchain/evm/utils";
import { config } from "../config/config";
import { VaultMintNFTService } from "../blockchain/evm/services/nftService/vaultNFTService";
import { DirectMintNFTService } from "../blockchain/evm/services/nftService/directNFTService";
import { ethers } from "ethers";
import { launchRepository } from "../repositories/launchRepository";
import { DEFAULT_CONTRACT_VERSION } from "blockchain/evm/contract-versions";

export const collectionServices = {
  create: async (
    data: Insertable<Collection>,
    name: string,
    priceForLaunchpad: number,
    issuerId: string,
    userLayerId: string,
    file?: Express.Multer.File,
    contractVersion: string = DEFAULT_CONTRACT_VERSION // Default to the latest version
  ) => {
    if (data.type === "SYNTHETIC")
      throw new CustomError(
        "You cannot directly create synthetic collection.",
        400
      );

    if (data.isBadge) data.type = "IPFS_CID";

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

    if (user.layer !== layer.layer || user.network !== layer.network)
      throw new CustomError(
        "You cannot create collection for this layerId with the current active account.",
        400
      );

    // Validate contract version
    try {
      // Check if the provided contract version is supported
      if (
        !DirectMintNFTService.getSupportedVersions().includes(contractVersion)
      ) {
        throw new CustomError(
          `Unsupported contract version: ${contractVersion}`,
          400
        );
      }
    } catch (error) {
      throw new CustomError(`Invalid contract version: ${error}`, 400);
    }

    let deployContractTxHex = null,
      ordinalCollection = null,
      l2Collection = null;

    // Check if this is an EVM chain
    if (layer.chainId && EVM_CONFIG.CHAINS[layer.chainId]) {
      const chainConfig = EVM_CONFIG.CHAINS[layer.chainId];
      const symbol = generateSymbol(name);

      // Use appropriate NFT service based on collection type
      if (
        data.type === "INSCRIPTION" ||
        data.type === "RECURSIVE_INSCRIPTION"
      ) {
        // For inscriptions, use VaultMintNFTService since minting will be controlled by vault
        const vaultMintService = new VaultMintNFTService(chainConfig.RPC_URL);
        const unsignedTx =
          await vaultMintService.getUnsignedDeploymentTransaction(
            user.address,
            config.VAULT_ADDRESS,
            name,
            symbol,
            chainConfig.DEFAULT_ROYALTY_FEE,
            chainConfig.DEFAULT_PLATFORM_FEE,
            config.VAULT_ADDRESS
          );
        deployContractTxHex = serializeBigInt(unsignedTx);
      } else if (data.type === "IPFS_CID" || data.type === "IPFS_FILE") {
        // For IPFS collections, use DirectMintNFTService since users will mint directly
        const directMintService = new DirectMintNFTService(
          chainConfig.RPC_URL,
          contractVersion
        );

        const unsignedTx =
          await directMintService.getUnsignedDeploymentTransaction(
            user.address, // contract owner
            name,
            symbol,
            chainConfig.DEFAULT_ROYALTY_FEE,
            chainConfig.DEFAULT_PLATFORM_FEE
          );

        deployContractTxHex = serializeBigInt(unsignedTx);
      }
    }
    console.log("🚀 ~ layer:", layer);
    if (layer.layerType == "EVM" && deployContractTxHex == null)
      throw new CustomError("Couldn't create deploy contract hex", 400);

    if (file) {
      const key = randomUUID();
      await uploadToS3(key, file);
      data.logoKey = key;
    }

    if (data.type === "INSCRIPTION" || data.type === "RECURSIVE_INSCRIPTION") {
      const bitcoinLayer = await layerRepository.getBitcoin("TESTNET");

      ordinalCollection = await collectionRepository.create({
        ...data,
        status: "UNCONFIRMED",
        creatorId: user.id,
        layerId: bitcoinLayer.id,
        ownerCount: 0

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
        contractVersion
      });
    } else if (data.type === "IPFS_CID" || data.type === "IPFS_FILE") {
      l2Collection = await collectionRepository.create({
        ...data,
        type: data.type,
        status: "UNCONFIRMED",
        creatorId: user.id,
        creatorUserLayerId: userLayerId,
        ownerCount: 0,
        contractVersion
      });
    }

    return { ordinalCollection, l2Collection, deployContractTxHex };
  },
  addPhase: async ({
    collectionId,
    phaseType,
    price,
    startTime,
    endTime,
    maxSupply,
    maxPerWallet,
    merkleRoot,
    layerId,
    userId,
    userLayerId
  }: {
    collectionId: string;
    phaseType: number;
    price: string;
    startTime: number;
    endTime: number;
    maxSupply: number;
    maxPerWallet: number;
    merkleRoot: string;
    layerId: string;
    userId: string;
    userLayerId: string;
  }) => {
    // Get collection and verify ownership
    const collection = await collectionRepository.getById(db, collectionId);
    if (!collection) {
      throw new CustomError("Collection not found", 404);
    }

    if (collection.creatorId !== userId) {
      throw new CustomError(
        "You are not authorized to modify this collection",
        403
      );
    }

    // Verify collection status
    if (collection.status !== "UNCONFIRMED") {
      throw new CustomError(
        "Collection must be in UNCONFIRMED status to add phases",
        400
      );
    }

    // Get layer and validate
    const layer = await layerServices.checkIfSupportedLayerOrThrow(layerId);
    if (!layer.chainId) {
      throw new CustomError("Invalid layer for phase setup", 400);
    }

    // Get user and validate
    const user = await userRepository.getByUserLayerId(userLayerId);
    if (!user) {
      throw new CustomError("User not found", 404);
    }
    if (!user.isActive) {
      throw new CustomError("This account is deactivated", 400);
    }
    if (user.layer !== layer.layer || user.network !== layer.network) {
      throw new CustomError(
        "You cannot modify collection for this layerId with the current active account",
        400
      );
    }

    if (!collection.contractAddress) {
      throw new CustomError("Collection contract address not found", 400);
    }

    // Initialize NFT service
    const chainConfig = EVM_CONFIG.CHAINS[layer.chainId];
    const contractVersion =
      collection.contractVersion || DEFAULT_CONTRACT_VERSION;
    const directMintService = new DirectMintNFTService(
      chainConfig.RPC_URL,
      contractVersion
    );

    // Get unsigned transaction
    const unsignedTx = await directMintService.getUnsignedAddPhaseTransaction(
      collection.contractAddress,
      phaseType,
      price,
      startTime,
      endTime,
      maxSupply,
      maxPerWallet,
      // merkleRoot || ethers.ZeroHash, // Use zero hash for public phase
      user.address
    );

    return serializeBigInt(unsignedTx);
  },

  updatePhase: async ({
    collectionId,
    launchId,
    phaseIndex,
    phaseType,
    price,
    startTime,
    endTime,
    maxSupply,
    maxPerWallet,
    merkleRoot,
    layerId,
    userId,
    userLayerId
  }: {
    collectionId: string;
    launchId: string;
    phaseIndex: number;
    phaseType: number;
    price: string;
    startTime: number;
    endTime: number;
    maxSupply: number;
    maxPerWallet: number;
    merkleRoot: string;
    layerId: string;
    userId: string;
    userLayerId: string;
  }) => {
    // Get collection and verify ownership
    const collection = await collectionRepository.getById(db, collectionId);
    if (!collection) {
      throw new CustomError("Collection not found", 404);
    }

    if (collection.creatorId !== userId) {
      throw new CustomError(
        "You are not authorized to modify this collection",
        403
      );
    }

    // Get layer and validate
    const layer = await layerServices.checkIfSupportedLayerOrThrow(layerId);
    if (!layer.chainId) {
      throw new CustomError("Invalid layer for phase setup", 400);
    }

    // Get user and validate
    const user = await userRepository.getByUserLayerId(userLayerId);
    if (!user) {
      throw new CustomError("User not found", 404);
    }
    if (!user.isActive) {
      throw new CustomError("This account is deactivated", 400);
    }
    if (user.layer !== layer.layer || user.network !== layer.network) {
      throw new CustomError(
        "You cannot modify collection for this layerId with the current active account",
        400
      );
    }

    if (!collection.contractAddress) {
      throw new CustomError("Collection contract address not found", 400);
    }

    // Initialize NFT service
    const chainConfig = EVM_CONFIG.CHAINS[layer.chainId];
    console.log("🚀 ~ collection.contractVersion:", collection.contractVersion);

    const contractVersion =
      collection.contractVersion || DEFAULT_CONTRACT_VERSION;
    console.log("🚀 ~ contractVersion:", contractVersion);
    const directMintService = new DirectMintNFTService(
      chainConfig.RPC_URL,
      contractVersion
    );

    // Validate phase index
    const phaseCount = await directMintService.getPhaseCount(
      collection.contractAddress
    );
    if (phaseIndex < 0 || phaseIndex >= Number(phaseCount)) {
      throw new CustomError(
        `Invalid phase index. Must be between 0 and ${Number(phaseCount) - 1}`,
        400
      );
    }

    // Get all phases to check for overlaps
    const phasesResponse = await directMintService.getAllPhases(
      collection.contractAddress
    );
    const allPhases = phasesResponse.phases;

    // Check for time overlaps with other phases
    for (let i = 0; i < allPhases.length; i++) {
      if (i === phaseIndex) continue; // Skip the phase we're updating

      const otherPhase = allPhases[i];
      const otherStart = otherPhase.startTime;
      const otherEnd = otherPhase.endTime;

      // Check if there's an overlap
      const hasOverlap =
        (startTime <= otherEnd || otherEnd === 0) && // Our start is before other's end (or other has no end)
        (endTime >= otherStart || endTime === 0); // Our end is after other's start (or we have no end)

      if (hasOverlap) {
        throw new CustomError(
          `Phase time overlaps with existing ${otherPhase.phaseTypeName} phase (index ${i}). ` +
            `It runs from ${new Date(otherStart * 1000).toLocaleString()} to ` +
            `${otherEnd > 0 ? new Date(otherEnd * 1000).toLocaleString() : "no end date"}.`,
          400
        );
      }
    }

    // Get unsigned transaction
    const unsignedTx =
      await directMintService.getUnsignedUpdatePhaseTransaction(
        collection.contractAddress,
        phaseIndex,
        phaseType,
        price,
        startTime,
        endTime,
        maxSupply,
        maxPerWallet,
        // merkleRoot || ethers.ZeroHash, // Use zero hash for public phase
        user.address
      );

    await collectionRepository.update(db, collectionId, {
      updatedAt: new Date()
    });

    if (phaseType == 0) {
      await launchRepository.update(launchId, {
        wlEndsAt: endTime.toString(),
        wlStartsAt: startTime.toString(),
        wlMintPrice: parseFloat(price),
        wlMaxMintPerWallet: maxPerWallet,
        updatedAt: new Date()
      });
    } else if (phaseType == 1) {
      await launchRepository.update(launchId, {
        fcfsEndsAt: endTime.toString(),
        fcfsStartsAt: startTime.toString(),
        fcfsMintPrice: parseFloat(price),
        fcfsMaxMintPerWallet: maxPerWallet,
        updatedAt: new Date()
      });
    } else if (phaseType == 2) {
      await launchRepository.update(launchId, {
        poEndsAt: endTime.toString(),
        poStartsAt: startTime.toString(),
        poMintPrice: parseFloat(price),
        poMaxMintPerWallet: maxPerWallet,
        updatedAt: new Date()
      });
    } else {
      throw new CustomError("Invalid phase type", 400);
    }
    return serializeBigInt(unsignedTx);
  },

  getPhasesByContractAddress: async ({
    collectionId,
    layerId
  }: {
    collectionId: string;
    layerId: string;
  }) => {
    // Get collection
    const collection = await collectionRepository.getById(db, collectionId);
    if (!collection) {
      throw new CustomError("Collection not found", 404);
    }

    // Get layer and validate
    const layer = await layerServices.checkIfSupportedLayerOrThrow(layerId);
    if (!layer.chainId) {
      throw new CustomError("Invalid layer for phase setup", 400);
    }

    if (!collection.contractAddress) {
      throw new CustomError("Collection contract address not found", 400);
    }

    const contractVersion =
      collection.contractVersion || DEFAULT_CONTRACT_VERSION;
    // Initialize NFT service
    const chainConfig = EVM_CONFIG.CHAINS[layer.chainId];
    const directMintService = new DirectMintNFTService(
      chainConfig.RPC_URL,
      contractVersion
    );

    const phases = await directMintService.getAllPhases(
      collection.contractAddress
    );

    return serializeBigInt(phases);
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
  }
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
