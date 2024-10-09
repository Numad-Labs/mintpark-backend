import { Insertable } from "kysely";
import { Collectible, Collection } from "../types/db/types";

import { collectionRepository } from "../repositories/collectionRepository";
import { db } from "../utils/db";
import { CustomError } from "../exceptions/CustomError";
import { getObjectFromS3, uploadToS3 } from "../utils/aws";
import { randomUUID } from "crypto";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { mintHelper } from "../libs/mintHelper";
import { LAYER_TYPE } from "../types/db/enums";
import { ASSETTYPE, SERVICE_FEE, SERVICE_FEE_ADDRESS } from "../libs/constants";
import { orderServices } from "./orderServices";
import { orderRepository } from "../repositories/orderRepository";
import { createP2TRFundingAddress } from "../libs/fundingAddress";

export const collectionServices = {
  create: async (
    data: Insertable<Collection>,
    file: Express.Multer.File,
    issuerAddress: string
  ) => {
    const key = randomUUID();
    await uploadToS3(key, file);

    data.logoKey = key;
    data.ownerAddress = issuerAddress;
    console.log(data);
    const collection = await collectionRepository.create(data, db);

    return collection;
  },
  addCollectiblesToCollection: async (
    files: Express.Multer.File[],
    // totalFileSize: number,
    collectionId: string,
    issuerAddress: string
    // feeRate: number,
    // mintLayerType: LAYER_TYPE
  ) => {
    const collection = await collectionRepository.getById(collectionId);
    if (!collection) throw new CustomError("Collection does not exist.", 400);

    if (collection.ownerAddress !== issuerAddress)
      throw new CustomError("You are not allowed to do this action.", 403);

    const collectibles: Insertable<Collectible>[] = [];

    for (let i = 0; i < files.length; i++) {
      const key = randomUUID();
      await uploadToS3(key, files[i]);
      const collectible = {
        collectionId: collection.id,
        fileKey: key,
        name: `${collection.name} #${collection.totalCount + i}`,
        ownerAddress: issuerAddress,
      };
      collectibles.push(collectible);
    }
    collection.totalCount += files.length;

    const updatedCollectibles = await collectibleRepository.create(
      collectibles,
      db
    );
    await collectionRepository.update(collection.id, collection);

    return updatedCollectibles;
  },
  createOrderToMintCollectible: async (
    collectionId: string,
    issuerAddress: string
  ) => {
    const collection = await collectionRepository.getById(collectionId);
    if (!collection) throw new CustomError("Collection does not exist.", 400);
    if (collection.ownerAddress !== issuerAddress)
      throw new CustomError("You are not allowed to do this action.", 403);

    const collectibles = await collectibleRepository.getByCollectionId(
      collection.id
    );

    const files = [];
    for (let i = 0; i < collectibles.length; i++) {
      const file = await getObjectFromS3(collectibles[i].fileKey);
      files.push({
        inscriptionData: file.content,
        inscriptionContentType: file.contentType!,
      });
    }
    const funder = createP2TRFundingAddress(
      files,
      SERVICE_FEE,
      collection.feeRate
    );
    const order = await orderRepository.create({
      user_address: issuerAddress,
      funding_address: funder.address,
      funding_private_key: funder.privateKey,
      amount: funder.requiredAmount,
      service_fee: SERVICE_FEE,
      network_fee: funder.requiredAmount - SERVICE_FEE,
      feeRate: collection.feeRate,
      layer_type: collection.layer_type,
      minting_type: "COLLECTION",
      quantity: collectibles.length,
      collection_id: collection.id,
    });

    return order;
  },
  generateHexForCollection: async (orderId: string, issuerAddress: string) => {
    let order = await orderRepository.getById(orderId);
    if (!order || !order.collection_id)
      throw new CustomError("Order for this collection does not exist.", 400);
    if (order.user_address !== issuerAddress)
      throw new CustomError("You are not authorized.", 403);

    const collection = await collectionRepository.getById(order.collection_id);
    if (!collection) throw new CustomError("Collection does not exist.", 400);

    const collectibles = await collectibleRepository.getByCollectionId(
      collection.id
    );

    let mintedCollectionCount: number = 0;
    let allMintResult = [];
    for (let i = 0; i < collectibles.length; i++) {
      if (collectibles[i].status !== "ACTIVE")
        throw new CustomError(
          "Some collectibles are not available to mint.",
          400
        );
      const file = await getObjectFromS3(collectibles[i].fileKey);
      const data = {
        address: issuerAddress,
        xpub: null,
        opReturnValues: (`data:${file.contentType};base64,` +
          file.content.toString("base64")) as any,
        assetType: ASSETTYPE.NFTONCHAIN,
        headline: collectibles[i].name,
        ticker: collection.name,
        supply: 1,
      };
      let mintResult = await mintHelper({
        layerType: order.layer_type,
        feeRate: order.feeRate,
        mintingParams: {
          data: data,
          toAddress: SERVICE_FEE_ADDRESS,
          price: SERVICE_FEE,
          fundingAddress: order.funding_address,
          fundingPrivateKey: order.funding_private_key,
        },
      });
      collectibles[i].status = "SOLD";
      collectibles[i].generatedPsbtTxId = mintResult.revealTxId;
      await collectibleRepository.update(collectibles[i].id, collectibles[i]);
      mintedCollectionCount++;
      allMintResult.push(mintResult);
    }
    collection.mintedCount = mintedCollectionCount;
    await collectionRepository.update(collection.id, collection);
    order = await orderRepository.updateOrderStatus(
      orderId,
      allMintResult[0].revealTxId
    );

    return {
      mintedCollectionCount,
      orderId: order.order_id,
      status: order.status,
    };
  },
  launchCollection: async (collectionId: string, issuerAddress: string) => {
    const collection = await collectionRepository.getById(collectionId);
    if (!collection) throw new CustomError("Collection does not exist.", 400);
    if (collection.ownerAddress !== issuerAddress)
      throw new CustomError("You are not allowed to do this action.", 403);

    if (collection.isLaunched)
      throw new CustomError("Collection already launched.", 400);
    collection.isLaunched = true;
    collection.status = "LIVE";
    await collectionRepository.update(collection.id, collection);

    return collection;
  },
};
