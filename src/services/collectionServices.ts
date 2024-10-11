import { Insertable } from "kysely";
import { Collectible, Collection } from "../types/db/types";
import { collectionRepository } from "../repositories/collectionRepository";
import { db } from "../utils/db";
import { CustomError } from "../exceptions/CustomError";
import { getObjectFromS3, uploadToS3 } from "../utils/aws";
import { randomUUID } from "crypto";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { mintHelper } from "../libs/mintHelper";
import { ASSETTYPE, SERVICE_FEE, SERVICE_FEE_ADDRESS } from "../libs/constants";
import { orderRepository } from "../repositories/orderRepository";
import { createFundingAddress } from "../libs/fundingAddress";
import { fileRepository } from "../repositories/fileRepository";

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
    collectionId: string,
    issuerAddress: string
  ) => {
    const collection = await collectionRepository.getById(collectionId);
    if (!collection) throw new CustomError("Collection does not exist.", 400);
    if (collection.ownerAddress !== issuerAddress)
      throw new CustomError("You are not allowed to do this action.", 403);

    for (let i = 0; i < files.length; i++) {
      const key = randomUUID();
      await uploadToS3(key, files[i]);
      const file = await fileRepository.create({
        collectionId: collection.id,
        fileKey: key,
      });
    }
    collection.totalCount += files.length;
    await collectionRepository.update(collection.id, collection);

    return collection;
  },

  createOrderToMintCollectible: async (
    collectionId: string,
    issuerAddress: string,
    feeRate: number
  ) => {
    const collection = await collectionRepository.getById(collectionId);
    if (!collection) throw new CustomError("Collection does not exist.", 400);
    if (collection.ownerAddress !== issuerAddress)
      throw new CustomError("You are not allowed to do this action.", 403);
    if (collection.isLaunched)
      throw new CustomError("Collection is already launched.", 400);

    collection.feeRate = feeRate;

    const retrievedFiles = await fileRepository.getByCollectionId(
      collection.id
    );

    const files = [];
    for (let i = 0; i < retrievedFiles.length; i++) {
      const file = await getObjectFromS3(retrievedFiles[i].fileKey);
      files.push({
        inscriptionData: file.content,
        inscriptionContentType: file.contentType!,
      });
    }

    collection.isActive = true;

    await collectionRepository.update(collection.id, collection);

    const funder = createFundingAddress({
      inscriptions: files,
      price: SERVICE_FEE,
      feeRate: collection.feeRate,
      layerType: collection.layerType,
    });
    let order = await orderRepository.getByCollectionId(collection.id);

    if (order) {
      if (order.status === "INSCRIBED")
        throw new CustomError("Order is already inscribed.", 400);
      order = await orderRepository.update(order.orderId, {
        status: "PENDING",
        fundingAddress: funder.address,
        fundingPrivateKey: funder.privateKey,
        amount: funder.requiredAmount,
        serviceFee: SERVICE_FEE,
        networkFee: funder.requiredAmount - SERVICE_FEE,
        feeRate: collection.feeRate,
        layerType: collection.layerType,
        mintingType: "COLLECTION",
        quantity: files.length,
        collectionId: collection.id,
        updatedAt: new Date(),
      });
      return order;
    }

    order = await orderRepository.create({
      userAddress: issuerAddress,
      fundingAddress: funder.address,
      fundingPrivateKey: funder.privateKey,
      amount: funder.requiredAmount,
      serviceFee: SERVICE_FEE,
      networkFee: funder.requiredAmount - SERVICE_FEE,
      feeRate: collection.feeRate,
      layerType: collection.layerType,
      mintingType: "COLLECTION",
      quantity: files.length,
      collectionId: collection.id,
    });

    return order;
  },
  generateHexForCollection: async (orderId: string, issuerAddress: string) => {
    let order = await orderRepository.getById(orderId);
    if (!order || !order.collectionId)
      throw new CustomError("Order for this collection does not exist.", 400);
    if (order.userAddress !== issuerAddress)
      throw new CustomError("You are not authorized.", 403);
    if (order.status !== "PENDING")
      throw new CustomError("Order is not pending.", 400);

    const files = await fileRepository.getByCollectionId(order.collectionId);
    if (files.length !== order.quantity)
      throw new CustomError("Number of files does not match the order.", 400);
    const collection = await collectionRepository.getById(order.collectionId);
    if (!collection) throw new CustomError("Collection does not exist.", 400);
    let mintedCollectionCount: number = 0;
    let allMintResult = [];
    for (let i = 0; i < files.length; i++) {
      const file = await getObjectFromS3(files[i].fileKey);
      const data = {
        address: issuerAddress,
        xpub: null,
        opReturnValues: (`data:${file.contentType};base64,` +
          file.content.toString("base64")) as any,
        assetType: ASSETTYPE.NFTONCHAIN,
        headline: collection?.name,
        ticker: "nft",
        supply: 1,
      };
      let mintResult = await mintHelper({
        layerType: order.layerType,
        feeRate: order.feeRate,
        mintingParams: {
          data: data,
          toAddress: SERVICE_FEE_ADDRESS[order.layerType] as string,
          price: SERVICE_FEE,
          fundingAddress: order.fundingAddress,
          fundingPrivateKey: order.fundingPrivateKey,
        },
      });

      //One minute promise between each minting
      new Promise((resolve) => setTimeout(resolve, 60000));

      files[i].status = "MINTED";
      files[i].generatedPsbtTxId = mintResult.revealTxId;
      await fileRepository.update(files[i].id, files[i]);
      mintedCollectionCount++;
      allMintResult.push(mintResult);

      console.log(`Collection item #${mintedCollectionCount} minted.`);
    }
    collection.mintedCount = mintedCollectionCount;
    collection.totalCount = collection.totalCount - mintedCollectionCount;
    await collectionRepository.update(collection.id, collection);
    order = await orderRepository.updateOrderStatus(
      orderId,
      allMintResult[0].revealTxId
    );

    console.log("All collections minted successfully.");

    return {
      orderId: order.orderId,
      orderStatus: order.status,
      mintedCollectionCount,
      allMintResult,
    };
  },
  launchCollection: async (
    collectionId: string,
    issuerAddress: string,
    POStartDate: string,
    walletLimit: number,
    price: number
  ) => {
    const collection = await collectionRepository.getById(collectionId);
    if (!collection) throw new CustomError("Collection does not exist.", 400);
    if (collection.ownerAddress !== issuerAddress)
      throw new CustomError("You are not allowed to do this action.", 403);

    if (collection.isLaunched)
      throw new CustomError("Collection already launched.", 400);

    const files = await fileRepository.getPendingFilesByCollectionId(
      collection.id
    );
    if (files.length !== collection.totalCount)
      throw new CustomError("No files available for launch.", 400);

    const collectibles: Insertable<Collectible>[] = [];
    for (let i = 0; i < files.length; i++) {
      const collectible = {
        collectionId: collection.id,
        fileKey: files[i].fileKey,
        name: `${collection.name} #${i + 1}`,
        ownerAddress: issuerAddress,
      };
      collectibles.push(collectible);
    }

    await collectibleRepository.create(collectibles, db);

    collection.isLaunched = true;
    collection.isActive = true;
    collection.status = "LIVE";
    collection.POStartDate = POStartDate;
    collection.walletLimit = walletLimit;
    collection.price = price;

    await collectionRepository.update(collection.id, collection);

    return collection;
  },
};
