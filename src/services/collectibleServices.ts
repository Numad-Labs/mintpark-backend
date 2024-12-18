import {
  CollectibleQueryParams,
  ipfsNftParams,
  recursiveInscriptionParams,
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
import { db } from "../utils/db";
import { randomUUID } from "crypto";
import { uploadToS3 } from "../utils/aws";
import { Insertable } from "kysely";
import {
  Collectible,
  CollectibleTrait,
  Collection,
  OrderItem,
} from "../types/db/types";
import { orderItemRepository } from "../repositories/orderItemRepository";
import { traitValueRepository } from "../repositories/traitValueRepository";
import { collectibleTraitRepository } from "../repositories/collectibleTraitRepository";
import { param } from "../routes/userRoutes";
import { getBalance } from "../blockchain/bitcoin/libs";

const evmCollectibleService = new EVMCollectibleService(EVM_CONFIG.RPC_URL!);
const confirmationService = new TransactionConfirmationService(
  EVM_CONFIG.RPC_URL!
);

export const collectibleServices = {
  getListableCollectibles: async (
    userId: string,
    userLayerId: string,
    params: CollectibleQueryParams
  ) => {
    const user = await userRepository.getByUserLayerId(userLayerId);
    if (!user) throw new CustomError("User not found.", 400);
    if (user.id !== userId) throw new CustomError("User not found.", 400);
    if (!user?.isActive)
      throw new CustomError("This account is deactivated.", 400);
    // if (user.layerId !== params.layerId)
    //   throw new CustomError("Differing layerId.", 400);

    const layerType = await layerRepository.getById(user.layerId!);
    if (!layerType) throw new CustomError("Unsupported layer type.", 400);
    const uniqueIdxs: string[] = [];
    if (layerType.layer === "CITREA" && layerType.network === "TESTNET") {
      const collections = await collectionRepository.getCollectionsByLayer(
        user.layerId
      );
      // if (collections?.length) {
      //   console.log(`Found ${collections.length} CITREA collections`);
      //   // Filter valid collections and process them in parallel
      //   const validCollections = collections.filter((c) => c.contractAddress);
      //   const tokenResults = await Promise.all(
      //     validCollections.map(async (collection) => {
      //       try {
      //         const tokenIds = await evmCollectibleService.getOwnedTokens(
      //           collection.contractAddress!,
      //           user.address
      //         );
      //         if (!tokenIds?.length) return [];
      //         console.log(
      //           `Found ${tokenIds.length} tokens for contract: ${collection.contractAddress}`
      //         );
      //         return tokenIds.map(
      //           (tokenId) => `${collection.contractAddress}i${tokenId}`
      //         );
      //       } catch (error) {
      //         console.error(
      //           `Error processing collection ${collection.contractAddress}:`,
      //           error
      //         );
      //         return [];
      //       }
      //     })
      //   );
      if (collections?.length) {
        // Filter valid collections
        const validCollections = collections
          .filter((c) => c.contractAddress)
          .map((c) => c.contractAddress!);
        // Process collections in batches using the new method
        const tokenResults = await evmCollectibleService.processCollections(
          validCollections,
          user.address
        );
        // Convert the results into the required format
        for (const [contractAddress, tokenIds] of Object.entries(
          tokenResults
        )) {
          if (tokenIds.length) {
            const formattedTokens = tokenIds.map(
              (tokenId) => `${contractAddress}i${tokenId}`
            );
            uniqueIdxs.push(...formattedTokens);
          }
        }
      }
      // return uniqueIdxs;
    } /* else if (layerType.layer === "FRACTAL") {
      const inscriptionUtxos = await getInscriptionUtxosByAddress(
        user.address,
        true
      );
      inscriptionUtxos.map((inscriptionUtxo) => {
        inscriptionUtxo.inscriptions[0].inscriptionId;
        uniqueIdxs.push(inscriptionUtxo.inscriptions[0].inscriptionId);
      });
    } */

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
    const totalCount = Number(totalCountResult?.count ?? 0);

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
    // if (!listableCollectibles[0].contractAddress) {
    //   throw new Error("Collectible with no contract address.");
    // }
    // const totalOwnerCount =
    //   await evmCollectibleService.getCollectionOwnersCount(
    //     listableCollectibles[0].contractAddress
    //   );

    return {
      listableCollectibles,
      activeListCount: countResult?.activeListCount ?? 0,
      // totalOwnerCount,
    };
  },
  getActivityByCollectibleId: async (collectibleId: string) => {
    const collectible = await collectibleRepository.getById(collectibleId);
    if (!collectible) throw new CustomError("Collectible not found.", 400);
    if (!collectible.mintingTxId)
      throw new CustomError("Collectible does not have txid.", 400);
    if (!collectible.uniqueIdx)
      throw new CustomError("Collectible does not have unique index.", 400);

    const collection = await collectionRepository.getById(
      db,
      collectible.collectionId
    );
    if (!collection) throw new CustomError("collection not found.", 400);
    if (!collection.contractAddress)
      throw new CustomError("contractAddress not found", 400);
    // const collectionAddress = collectible.uniqueIdx.split("i")[0];
    const tokenId = collectible.uniqueIdx.split("i")[1];
    const transactionDetail = await confirmationService.getTransactionDetails(
      collectible.mintingTxId
    );
    const activities = await evmCollectibleService.getActivityByTokenId(
      collection.contractAddress,
      tokenId,
      transactionDetail.blockNumber
    );

    return activities;
  },
  createInscriptions: async (
    collectionId: string,
    names: string[],
    startIndex: number,
    files: Express.Multer.File[]
  ) => {
    const fileKeys = await Promise.all(
      files.map(async (file) => {
        const key = randomUUID().toString();
        if (file) await uploadToS3(key, file);
        return {
          key,
        };
      })
    );
    const collectiblesData: Insertable<Collectible>[] = [];
    for (let i = 0; i < fileKeys.length; i++)
      collectiblesData.push({
        name: names[i],
        fileKey: fileKeys[i].key,
        collectionId,
        nftId: (startIndex + i).toString(),
      });
    const collectibles = await collectibleRepository.bulkInsert(
      collectiblesData
    );

    return collectibles;
  },
  createInscriptionAndOrderItemInBatch: async (
    userId: string,
    collectionId: string,
    names: string[],
    files: Express.Multer.File[]
  ) => {
    const collection = await collectionRepository.getById(db, collectionId);
    if (!collection) throw new CustomError("Invalid collectionId.", 400);
    if (collection?.type !== "INSCRIPTION")
      throw new CustomError("Invalid collection type.", 400);

    const order = await orderRepository.getByCollectionId(collectionId);
    if (order?.userId !== userId)
      throw new CustomError(
        "You are not allowed to create trait value for this collection.",
        400
      );
    if (!order.fundingAddress)
      throw new CustomError("Invalid order with undefined address.", 400);

    const balance = await getBalance(order.fundingAddress);
    if (balance < order.fundingAmount)
      throw new CustomError("Fee has not been transferred yet.", 400);

    const existingCollectibleCount =
      await orderItemRepository.getOrderItemCountByCollectionId(collection.id);
    const collectibles = await collectibleServices.createInscriptions(
      collectionId,
      names,
      Number(existingCollectibleCount),
      files
    );

    const orderItemsData: Insertable<OrderItem>[] = [];
    for (let i = 0; i < collectibles.length; i++)
      orderItemsData.push({
        collectibleId: collectibles[i].id,
        orderId: order.id,
        type: "COLLECTIBLE",
      });
    const orderItems = await orderItemRepository.bulkInsert(orderItemsData);

    return { collectibles, orderItems };
  },
  createRecursiveInscriptions: async (
    collectionId: string,
    startIndex: number,
    data: recursiveInscriptionParams[]
  ) => {
    const collectiblesData: Insertable<Collectible>[] = [];
    const collectibleTraitData: Insertable<CollectibleTrait>[] = [];
    for (let i = 0; i < data.length; i++) {
      let collectibleId = randomUUID().toString();
      collectiblesData.push({
        id: collectibleId,
        name: data[i].name,
        collectionId,
        nftId: (startIndex + i).toString(),
      });

      for (const trait of data[i].traits) {
        const traitValue =
          await traitValueRepository.getByNameValueAndCollectionId(
            trait.type,
            trait.value,
            collectionId
          );

        if (!traitValue)
          throw new CustomError("Unregistered trait value.", 400);

        collectibleTraitData.push({
          collectibleId,
          traitValueId: traitValue.id,
        });
      }
    }

    const collectibles = await collectibleRepository.bulkInsert(
      collectiblesData
    );
    const collectibleTraits = await collectibleTraitRepository.bulkInsert(
      collectibleTraitData
    );

    return { collectibles, collectibleTraits };
  },
  createRecursiveInscriptionAndOrderItemInBatch: async (
    userId: string,
    collectionId: string,
    data: recursiveInscriptionParams[]
  ) => {
    const collection = await collectionRepository.getById(db, collectionId);
    if (!collection) throw new CustomError("Invalid collectionId.", 400);
    if (collection?.type !== "RECURSIVE_INSCRIPTION")
      throw new CustomError("Invalid collection type.", 400);

    const order = await orderRepository.getByCollectionId(collectionId);
    if (order?.userId !== userId)
      throw new CustomError(
        "You are not allowed to create trait value for this collection.",
        400
      );

    if (!order.fundingAddress)
      throw new CustomError("Invalid order with undefined address.", 400);

    const balance = await getBalance(order.fundingAddress);
    if (balance < order.fundingAmount)
      throw new CustomError("Fee has not been transferred yet.", 400);

    const existingCollectibleCount =
      await orderItemRepository.getOrderItemCountByCollectionId(collection.id);
    const result = await collectibleServices.createRecursiveInscriptions(
      collectionId,
      Number(existingCollectibleCount),
      data
    );

    const orderItemsData: Insertable<OrderItem>[] = [];
    for (let i = 0; i < result.collectibles.length; i++)
      orderItemsData.push({
        collectibleId: result.collectibles[i].id,
        orderId: order.id,
        type: "COLLECTIBLE",
      });
    const orderItems = await orderItemRepository.bulkInsert(orderItemsData);

    return {
      collectibles: result.collectibles,
      collectibleTraits: result.collectibleTraits,
      orderItems,
    };
  },
  createIpfsNfts: async (
    collection: { id: string; contractAddress: string | null },
    startIndex: number,
    data: ipfsNftParams[]
  ) => {
    const collectiblesData: Insertable<Collectible>[] = [];
    for (let i = 0; i < data.length; i++) {
      //TODO: data[i].cid validation?
      const isValidCid = true;
      if (!isValidCid) throw new CustomError("Invalid cid.", 400);

      collectiblesData.push({
        name: data[i].name,
        cid: data[i].cid,
        collectionId: collection.id,
        uniqueIdx:
          collection.contractAddress + "i" + (startIndex + i).toString(),
        nftId: (startIndex + i).toString(),
      });
    }
    const collectibles = await collectibleRepository.bulkInsert(
      collectiblesData
    );

    return collectibles;
  },
  createIpfsNftAndOrderItemInBatch: async (
    userId: string,
    collectionId: string,
    data: ipfsNftParams[]
  ) => {
    const collection = await collectionRepository.getById(db, collectionId);
    if (!collection) throw new CustomError("Invalid collectionId.", 400);
    if (collection?.type !== "IPFS")
      throw new CustomError("Invalid collection type.", 400);

    const order = await orderRepository.getByCollectionId(collectionId);
    if (order?.userId !== userId)
      throw new CustomError(
        "You are not allowed to create trait value for this collection.",
        400
      );
    if (!order.fundingAddress)
      throw new CustomError("Invalid order with undefined address.", 400);

    const balance = await getBalance(order.fundingAddress);
    if (balance < order.fundingAmount)
      throw new CustomError("Fee has not been transferred yet.", 400);

    const existingCollectibleCount =
      await orderItemRepository.getOrderItemCountByCollectionId(collection.id);
    const collectibles = await collectibleServices.createIpfsNfts(
      collection,
      Number(existingCollectibleCount),
      data
    );

    const orderItemsData: Insertable<OrderItem>[] = [];
    for (let i = 0; i < collectibles.length; i++)
      orderItemsData.push({
        collectibleId: collectibles[i].id,
        orderId: order.id,
        type: "COLLECTIBLE",
      });
    const orderItems = await orderItemRepository.bulkInsert(orderItemsData);

    return { collectibles, orderItems };
  },
};
