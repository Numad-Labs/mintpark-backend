import { Insertable } from "kysely";
import { Collectible, Collection } from "../types/db/types";

import { collectionRepository } from "../repositories/collectionRepository";
import { db } from "../utils/db";
import { CustomError } from "../exceptions/CustomError";
import { getObjectFromS3, uploadToS3 } from "../utils/aws";
import { randomUUID } from "crypto";
import { collectibleServices } from "./collectibleServices";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { mintCollection } from "../libs/bitcoinL1/mintCollection";
import { mintHelper } from "../libs/mintHelper";
import { LAYER_TYPE } from "../types/db/enums";
import { ASSETTYPE, SERVICE_FEE, SERVICE_FEE_ADDRESS } from "../libs/constants";
import { orderRepository } from "../repositories/orderRepository";

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

    const updatedCollectibes = await collectibleRepository.create(
      collectibles,
      db
    );
    await collectionRepository.update(collection.id, collection);

    return updatedCollectibes;
  },
  mintCollection: async (collectionId: string, issuerAddress: string) => {
    const collection = await collectionRepository.getById(collectionId);
    if (!collection) throw new CustomError("Collection does not exist.", 400);
    if (collection.ownerAddress !== issuerAddress)
      throw new CustomError("You are not allowed to do this action.", 403);

    const collectibles = await collectibleRepository.getByCollectionId(
      collection.id
    );

    if (collectibles.length < 1)
      throw new CustomError("No collectibles found in this collection.", 400);

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
        layerType: LAYER_TYPE.BITCOIN_TESTNET,
        feeRate: 1,
        mintingParams: {
          data: data,
          toAddress: SERVICE_FEE_ADDRESS,
          price: SERVICE_FEE,
          fundingAddress: "tb1qzr9zqc5d7zj7ktxnfdeueqmxwfwdvrme87dtd7",
          fundingPrivateKey:
            "9beee8682dd93eb9f757f239271a3b001c6a11dfa7cb7f938e8172ed9db7757d",
        },
      });
      collectibles[i].status = "ON_HOLD";
      collectibles[i].generatedPsbtTxId = mintResult.revealTxId;
      await collectibleRepository.update(collectibles[i].id, collectibles[i]);
      mintedCollectionCount++;
      allMintResult.push(mintResult);
    }
    collection.mintedCount = mintedCollectionCount;
    await collectionRepository.update(collection.id, collection);

    return { mintedCollectionCount, allMintResult };
  },
};
