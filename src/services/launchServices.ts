import { randomUUID } from "crypto";
import { launchRepository } from "../repositories/launchRepository";
import { Launch } from "@prisma/client";
import { getObjectFromS3, uploadToS3 } from "../utils/aws";
import { launchItemRepository } from "../repositories/launchItemRepository";
import { collectionRepository } from "../repositories/collectionRepository";
import { userRepository } from "../repositories/userRepository";
import { LaunchOfferType } from "../controllers/launchController";
import { orderServices } from "./orderServices";
import { orderRepository } from "../repositories/orderRepostory";
import { createFundingAddress } from "../../blockchain/utxo/fundingAddressHelper";
import { layerRepository } from "../repositories/layerRepository";
import {
  ASSETTYPE,
  SERVICE_FEE,
  SERVICE_FEE_ADDRESS,
} from "../../blockchain/utxo/constants";
import { getEstimatedFee } from "../../blockchain/utxo/calculateRequiredAmount";
import { purchaseRepository } from "../repositories/purchaseRepository";
import { mint } from "../../blockchain/utxo/fractal/mint";
import { sendRawTransactionWithNode } from "../../blockchain/utxo/fractal/libs";

export const launchServices = {
  create: async (data: any, files: Express.Multer.File[]) => {
    const collection = await collectionRepository.getById(data.collectionId);
    if (!collection) throw new Error("Collection not found.");

    if (collection.type === "LAUNCHED")
      throw new Error("Collection already launched.");

    if (files.length < 1)
      throw new Error("Launch must have at least one file.");
    const launch = await launchRepository.create(data);

    const launchItems = await createLaunchItems(launch.id, files);

    const updatedCollection = await collectionRepository.update(collection.id, {
      type: "LAUNCHED",
      supply: collection.supply + launchItems.length,
    });

    return { launch, updatedCollection, launchItems };
  },
  generateOrderForLaunchedCollection: async (
    collectionId: string,
    issuerId: string,
    feeRate: number,
    launchOfferType: LaunchOfferType
  ) => {
    //TODO
    const user = await userRepository.getById(issuerId);
    if (!user) throw new Error("User not found.");

    const layer = await layerRepository.getById(user.layerId!);
    if (!layer) throw new Error("Layer not found.");

    const collection = await collectionRepository.getLaunchedCollectionById(
      collectionId
    );
    if (!collection) throw new Error("Collection not found.");

    const issueDate = new Date();

    const launchItems = await launchItemRepository.getActiveLaunchItems(
      collectionId
    );
    if (!launchItems) throw new Error("Launch items not found.");

    const winnerIndex = Math.floor(Math.random() * launchItems.length);

    const pickedItem = launchItems[winnerIndex - 1];
    const file = await getObjectFromS3(pickedItem.fileKey);

    switch (launchOfferType.offerType) {
      case "public":
        // if (collection.poEndsAt < issueDate)
        //   throw new Error("Public offer has ended.");
        // if (collection.poStartsAt > issueDate)
        //   throw new Error("Public offer has not started yet.");

        const { estimatedFee } = getEstimatedFee(
          [(file.content as Buffer).length],
          [file.contentType!.length],
          SERVICE_FEE[layer.layer][layer.network],
          feeRate,
          collection.poMintPrice
        );

        const funder = createFundingAddress(layer.layer, layer.network);

        const order = await orderRepository.create({
          userId: issuerId,
          collectionId: collectionId,
          quantity: 1,
          feeRate,
          orderType: "LAUNCH",
          fundingAddress: funder.address,
          privateKey: funder.privateKey,
          serviceFee: estimatedFee.serviceFee,
          networkFee: estimatedFee.networkFee,
          fundingAmount: estimatedFee.totalAmount,
        });

        const purchase = await purchaseRepository.create({
          userId: issuerId,
          orderId: order.id,
          launchItemId: pickedItem.id,
        });

        return { order, launchedItem: pickedItem };

      case "whitelist":
        //TODO
        break;
      default:
        throw new Error("Invalid launch offer type.");
    }
  },
  mintPickedCollection: async (orderId: string, issuerId: string) => {
    const user = await userRepository.getById(issuerId);
    if (!user) throw new Error("User not found.");

    const purchase = await purchaseRepository.getByOrderId(orderId);
    if (!purchase) throw new Error("Order has not been created yet.");

    const order = await orderRepository.getById(orderId);
    if (!order) throw new Error("Order not found.");

    if (order.orderStatus !== "PENDING")
      throw new Error("Order is not pending.");

    const collection = await collectionRepository.getLaunchedCollectionById(
      order.collectionId!
    );
    if (!collection) throw new Error("Collection not found.");

    const launchItem = await launchItemRepository.getById(
      purchase.launchItemId
    );
    if (!launchItem) throw new Error("Launch item not found.");

    const file = await getObjectFromS3(launchItem.fileKey);

    const tokenData = {
      address: user.address,
      xpub: null,
      opReturnValues: `data:${file.contentType};base64,${(
        file.content as Buffer
      ).toString("base64")}` as any,
      assetType: ASSETTYPE.NFTOFFCHAIN,
      supply: 1,
      headline: "headline",
      ticker: "test",
    };
    const mintHexes = await mint(
      tokenData,
      order.fundingAddress,
      order.privateKey,
      true,
      SERVICE_FEE_ADDRESS["FRACTAL"]["MAINNET"],
      SERVICE_FEE["FRACTAL"]["MAINNET"],
      order.feeRate,
      "bc1pffk5397d7sns6mayud03nf3fxy4p04e3alhslr6epaq3a788tsuqkxg0rn", // TODO. Collection Owner address bolgoh
      collection.poMintPrice
    );

    const commitTxId = await sendRawTransactionWithNode(mintHexes!.commitTxHex);
    console.log(`Commit transaction sent: ${commitTxId}`);
    const revealTxId = await sendRawTransactionWithNode(mintHexes!.revealTxHex);
    console.log(`Reveal transaction sent: ${revealTxId}`);

    await orderRepository.update(orderId, {
      paidAt: new Date(),
      orderStatus: "DONE",
    });

    await launchItemRepository.update(launchItem.id, { status: "SOLD" });

    return { commitTxId, revealTxId };
  },
};

async function createLaunchItems(
  launchId: string,
  files: Express.Multer.File[]
): Promise<any[]> {
  return await Promise.all(
    files.map(async (file) => {
      const key = randomUUID();
      await uploadToS3(key, file);
      return await launchItemRepository.create({
        launchId,
        fileKey: key,
      });
    })
  );
}
