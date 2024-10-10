import { Insertable } from "kysely";
import { Collectible } from "../types/db/types";
import { collectionRepository } from "../repositories/collectionRepository";
import { CustomError } from "../exceptions/CustomError";
import { s3, uploadToS3 } from "../utils/aws";
import { hash, randomUUID } from "crypto";
import { db } from "../utils/db";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { orderRepository } from "../repositories/orderRepository";
import { createFundingAddress } from "../libs/fundingAddress";
import { encryptionHelper } from "../libs/encryptionHelper";
import { ASSETTYPE, SERVICE_FEE, SERVICE_FEE_ADDRESS } from "../libs/constants";
import { getObjectFromS3 } from "../utils/aws";
import { tokenData } from "../../custom";
import { userRepository } from "../repositories/userRepository";
import { mintHelper } from "../libs/mintHelper";
import { LAYER_TYPE } from "../types/db/enums";

export const collectibleServices = {
  create: async (
    data: Insertable<Collectible>[],
    files: Express.Multer.File[],
    userId: string
  ) => {
    const collection = await collectionRepository.getById(data[0].collectionId);

    if (!collection) throw new CustomError("Collection does not exist.", 400);

    for (let i = 1; i < data.length; i++) {
      if (data[i].collectionId !== data[i - 1].collectionId)
        throw new CustomError(
          "Collectibles with different collectionIds.",
          400
        );
    }

    if (collection.ownerAddress !== userId)
      throw new CustomError("You are not authorized.", 403);

    const collectibles: Insertable<Collectible>[] = [];

    for (let i = 0; i < files.length; i++) {
      const key = randomUUID();
      await uploadToS3(key, files[i]);

      data[i].fileKey = key;
      data[i].name = `${collection.name} #${i}`;

      collectibles.push(data[i]);
    }

    const createdCollectibles = await collectibleRepository.create(
      collectibles,
      db
    );

    collection.totalCount += data.length;
    await collectionRepository.update(collection.id, collection);

    return createdCollectibles;
  },
  createOrderToMintCollectible: async (
    file: Express.Multer.File,
    userAddress: string,
    mintlayerType: LAYER_TYPE,
    feeRate: string
  ) => {
    const key = randomUUID();
    await uploadToS3(key, file);

    const funder = createFundingAddress({
      inscriptions: [
        {
          inscriptionContentType: file.mimetype,
          inscriptionData: file.buffer,
        },
      ],
      price: SERVICE_FEE,
      feeRate: Number(feeRate),
      layerType: mintlayerType,
    });

    const hashedPrivateKey = funder.privateKey;

    const order = await orderRepository.create({
      amount: funder.requiredAmount,
      feeRate: Number(feeRate),
      userAddress: userAddress,
      fundingAddress: funder.address,
      fundingPrivateKey: hashedPrivateKey,
      serviceFee: SERVICE_FEE,
      networkFee: funder.requiredAmount - SERVICE_FEE,
      collectibleKey: key,
      layerType: mintlayerType,
      mintingType: "COLLECTIBLE",
      quantity: 1,
    });

    return order;
  },
  generateHexForCollectible: async (orderId: string, userAddress: string) => {
    let order = await orderRepository.getById(orderId);
    if (!order) throw new CustomError("Order does not exist.", 400);

    // if (order.status !== "PENDING")
    //   throw new CustomError(
    //     "Order is not pending. Already inscribed or closed.",
    //     400
    //   );

    if (order.userAddress !== userAddress)
      throw new CustomError("You are not authorized.", 403);

    const file = await getObjectFromS3(order.collectibleKey as string);

    try {
      const data = {
        address: userAddress,
        xpub: null,
        opReturnValues: (`data:${file.contentType};base64,` +
          file.content.toString("base64")) as any,
        assetType: ASSETTYPE.NFTONCHAIN,
        headline: "headline",
        ticker: "test",
        supply: 1,
      };

      const result = await mintHelper({
        layerType: order.layerType,
        feeRate: order.feeRate,
        mintingParams: {
          data: data,
          toAddress: SERVICE_FEE_ADDRESS,
          price: SERVICE_FEE,
          fundingAddress: order.fundingAddress,
          fundingPrivateKey: order.fundingPrivateKey,
        },
      });

      order = await orderRepository.updateOrderStatus(
        orderId,
        result.revealTxId
      );

      return {
        orderId: order.orderId,
        orderStatus: order.status,
        result,
      };
    } catch (error) {
      throw error;
    }
  },
};
