import {
  CollectibleQueryParams,
  ipfsData,
  recursiveInscriptionParams,
  traitFilter
} from "../controllers/collectibleController";
import { CustomError } from "../exceptions/CustomError";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { collectionRepository } from "../repositories/collectionRepository";
import { layerRepository } from "../repositories/layerRepository";
import { listRepository } from "../repositories/listRepository";
import { userRepository } from "../repositories/userRepository";
import { EVMCollectibleService } from "../blockchain/evm/services/evmIndexService";
import { EVM_CONFIG } from "../blockchain/evm/evm-config";
import { TransactionConfirmationService } from "../blockchain/evm/services/transactionConfirmationService";
import { orderRepository } from "../repositories/orderRepostory";
import { db } from "../utils/db";
import { randomUUID } from "crypto";
import { uploadToS3 } from "../utils/aws";
import { Insertable } from "kysely";
import {
  Collectible,
  CollectibleTrait,
  Collection,
  OrderItem
} from "../types/db/types";
import { orderItemRepository } from "../repositories/orderItemRepository";
import { traitValueRepository } from "../repositories/traitValueRepository";
import { collectibleTraitRepository } from "../repositories/collectibleTraitRepository";
import { getBalance } from "../blockchain/bitcoin/libs";
import logger from "../config/winston";
import { BADGE_BATCH_SIZE } from "../libs/constants";
// import * as isIPFS from "is-ipfs";

const validateCid = (cid: string): boolean => {
  // CIDv0 starts with "Qm" and is 46 characters long
  const cidv0Regex = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;

  // CIDv1 - base32 or base58btc format
  const cidv1Regex = /^(b[a-z2-7]{58}|[1-9A-HJ-NP-Za-km-z]{48})$/;

  return cidv0Regex.test(cid) || cidv1Regex.test(cid);
};

const evmCollectibleService = new EVMCollectibleService(EVM_CONFIG.RPC_URL!);
const confirmationService = new TransactionConfirmationService(
  EVM_CONFIG.RPC_URL!
);

export const collectibleServices = {
  getListableCollectibles: async (
    userId: string,
    params: CollectibleQueryParams
  ) => {
    if (!params.userLayerId)
      throw new CustomError("Please provide an userLayerId.", 400);

    const user = await userRepository.getByUserLayerId(params.userLayerId);
    if (!user) throw new CustomError("User not found.", 400);
    if (user.id !== userId) throw new CustomError("User not found.", 400);
    if (!user.isActive)
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

    logger.info(`indexes: ${uniqueIdxs}`);

    if (uniqueIdxs.length === 0)
      return {
        collectibles: [],
        totalCount: 0,
        listCount: 0,
        collections: []
      };

    const [
      listableCollectibles,
      totalCountResult,
      listedCountResult,
      collections
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
      )
    ]);
    const listedCount = Number(listedCountResult?.activeListCount ?? 0);
    const totalCount = Number(totalCountResult?.count ?? 0);
    const hasMore = params.offset + params.limit < totalCount;

    return {
      collectibles: listableCollectibles,
      totalCount: totalCount,
      listCount: listedCount,
      hasMore,
      collections
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
    const [listableCollectibles, countResult, totalCountResult] =
      await Promise.all([
        collectibleRepository.getListableCollectiblesByCollectionId(
          collectionId,
          params,
          traitFilters
        ),
        listRepository.getActiveListCountByCollectionid(collectionId),
        collectibleRepository.getConfirmedCollectiblesCountByCollectionId(
          collectionId
        )
      ]);

    const totalCount = Number(totalCountResult?.collectibleCount ?? 0);
    const hasMore = params.offset + params.limit < totalCount;

    return {
      listableCollectibles,
      activeListCount: countResult?.activeListCount ?? 0,
      hasMore
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
  createCollectiblesByFiles: async (
    collection: { id: string; name: string },
    startIndex: number,
    files: Express.Multer.File[]
  ) => {
    //TODO: FIX THIS LATER
    startIndex++;
    const fileKeys = await Promise.all(
      files.map(async (file) => {
        const key = randomUUID().toString();
        if (file) await uploadToS3(key, file);
        return {
          key,
          fileName: file.filename
        };
      })
    );
    const collectiblesData: Insertable<Collectible>[] = [];
    for (let i = 0; i < fileKeys.length; i++)
      collectiblesData.push({
        name: `${collection.name} #${startIndex + i}`,
        fileKey: fileKeys[i].key,
        collectionId: collection.id,
        nftId: (startIndex + i).toString(),
        fileName: fileKeys[i].fileName
      });
    const collectibles = await collectibleRepository.bulkInsert(
      collectiblesData
    );

    return collectibles;
  },
  createInscriptionAndOrderItemInBatch: async (
    userId: string,
    collectionId: string,
    files: Express.Multer.File[]
  ) => {
    const collection = await collectionRepository.getById(db, collectionId);
    if (!collection) throw new CustomError("Invalid collectionId.", 400);
    if (collection?.type !== "INSCRIPTION")
      throw new CustomError("Invalid collection type.", 400);

    const order = await orderRepository.getByCollectionId(collectionId);
    if (!order) throw new CustomError("Order not found.", 400);
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
    const collectibles = await collectibleServices.createCollectiblesByFiles(
      { id: collection.id, name: collection.name },
      Number(existingCollectibleCount),
      files
    );

    const orderItemsData: Insertable<OrderItem>[] = [];
    for (let i = 0; i < collectibles.length; i++)
      orderItemsData.push({
        collectibleId: collectibles[i].id,
        orderId: order.id,
        type: "COLLECTIBLE"
      });
    const orderItems = await orderItemRepository.bulkInsert(orderItemsData);

    return { collectibles, orderItems };
  },
  createRecursiveInscriptions: async (
    collection: { id: string; name: string },
    startIndex: number,
    data: recursiveInscriptionParams[]
  ) => {
    startIndex++;
    const collectiblesData: Insertable<Collectible>[] = [];
    const collectibleTraitData: Insertable<CollectibleTrait>[] = [];
    for (let i = 0; i < data.length; i++) {
      let collectibleId = randomUUID().toString();
      collectiblesData.push({
        id: collectibleId,
        name: `${collection.name} #${startIndex + i}`,
        collectionId: collection.id,
        nftId: (startIndex + i).toString()
      });

      for (const trait of data[i].traits) {
        const traitValue =
          await traitValueRepository.getByNameValueAndCollectionId(
            trait.type,
            trait.value,
            collection.id
          );

        if (!traitValue)
          throw new CustomError("Unregistered trait value.", 400);

        collectibleTraitData.push({
          collectibleId,
          traitValueId: traitValue.id
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
    if (!order) throw new CustomError("Order not found.", 400);
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
      { id: collection.id, name: collection.name },
      Number(existingCollectibleCount),
      data
    );

    const orderItemsData: Insertable<OrderItem>[] = [];
    for (let i = 0; i < result.collectibles.length; i++)
      orderItemsData.push({
        collectibleId: result.collectibles[i].id,
        orderId: order.id,
        type: "COLLECTIBLE"
      });
    const orderItems = await orderItemRepository.bulkInsert(orderItemsData);

    return {
      collectibles: result.collectibles,
      collectibleTraits: result.collectibleTraits,
      orderItems
    };
  },
  createIpfsNftCollectibles: async (
    collection: { id: string; name: string; contractAddress: string | null },
    startIndex: number,
    data: string[]
  ) => {
    startIndex++;
    const collectiblesData: Insertable<Collectible>[] = [];
    for (let i = 0; i < data.length; i++) {
      //DG TODO done: data[i].cid validation? Test hiij uzeh
      // Validate CID using is-ipfs library
      const cid = data[i].trim();

      // // Check if it's a valid CID using is-ipfs
      // const isValidCid = isIPFS.cid(cid);
      // if (!isValidCid) throw new CustomError("Invalid cid.", 400);
      if (!validateCid(cid)) {
        throw new CustomError(`Invalid IPFS CID at index ${i}: ${cid}`, 400);
      }

      collectiblesData.push({
        name: `${collection.name} #${startIndex + i}`,
        cid: data[i],
        collectionId: collection.id,
        uniqueIdx:
          collection.contractAddress + "i" + (startIndex + i).toString(),
        nftId: (startIndex + i).toString()
      });
    }
    const collectibles = await collectibleRepository.bulkInsert(
      collectiblesData
    );

    return collectibles;
  },
  //TODO: add optional parameter for one file for when minting COLLECTIBLE(IPFS FILE), if existingCollectibleCount === 0 && file.count === 1
  createIpfsNftAndOrderItemInBatch: async (
    userId: string,
    collectionId: string,
    data: ipfsData
  ) => {
    const collection = await collectionRepository.getById(db, collectionId);
    if (!collection) throw new CustomError("Invalid collectionId.", 400);
    if (collection.type !== "IPFS_CID" && collection.type !== "IPFS_FILE")
      throw new CustomError("Invalid collection type.", 400);

    const order = await orderRepository.getByCollectionId(collectionId);
    if (!order) throw new CustomError("Order not found.", 400);
    if (order?.userId !== userId)
      throw new CustomError(
        "You are not allowed to create trait value for this collection.",
        400
      );
    if (!order.fundingAddress)
      throw new CustomError("Invalid order with undefined address.", 400);

    //DG TODO: IPFS BALANCE CHECK. CID ashiglaj bga gazar duudah heregtei bh. Shalgah ni good idea jhn hoishluulad hiiy
    // const balance = 0;
    // if (balance < order.fundingAmount)
    //   throw new CustomError("Fee has not been transferred yet.", 400);

    const existingCollectibleCount =
      await orderItemRepository.getOrderItemCountByCollectionId(collection.id);

    let collectibles: Insertable<Collectible>[] = [];
    if (collection.isBadge) {
      if (!collection.badgeCid || !collection.badgeSupply)
        throw new CustomError("Invalid badge details.", 400);

      collectibles = await collectibleServices.createIpfsBadgeCollectibles(
        {
          id: collection.id,
          name: collection.name,
          badgeSupply: collection.badgeSupply
        },
        Number(existingCollectibleCount),
        collection.badgeCid,
        collection.logoKey
      );
    } else {
      if (!data.CIDs)
        throw new CustomError("Invalid ipfs collectible data.", 400);

      collectibles = await collectibleServices.createIpfsNftCollectibles(
        collection,
        Number(existingCollectibleCount),
        data.CIDs
      );
    }

    const orderItemsData: Insertable<OrderItem>[] = [];
    for (let i = 0; i < collectibles.length; i++)
      orderItemsData.push({
        collectibleId: collectibles[i].id,
        orderId: order.id,
        type: "COLLECTIBLE"
      });
    const orderItems = await orderItemRepository.bulkInsert(orderItemsData);

    return { collectibles, orderItems };
  },
  createIpfsBadgeCollectibles: async (
    collection: {
      id: string;
      name: string;
      badgeSupply: number;
    },
    startIndex: number,
    cid: string,
    fileKey: string | null
  ) => {
    //TODO: FIX THIS LATER
    startIndex++;
    const nftCount =
      collection.badgeSupply - startIndex + 1 > BADGE_BATCH_SIZE
        ? BADGE_BATCH_SIZE
        : collection.badgeSupply - startIndex + 1;

    const collectiblesData: Insertable<Collectible>[] = [];
    for (let i = 0; i < nftCount; i++)
      collectiblesData.push({
        name: `${collection.name} #${startIndex + i}`,
        collectionId: collection.id,
        nftId: (startIndex + i).toString(),
        cid,
        fileKey
      });
    const collectibles = await collectibleRepository.bulkInsert(
      collectiblesData
    );

    return collectibles;
  }
};
