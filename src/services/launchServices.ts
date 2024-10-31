import { randomUUID } from "crypto";
import { launchRepository } from "../repositories/launchRepository";
import { getObjectFromS3, uploadToS3 } from "../utils/aws";
import { launchItemRepository } from "../repositories/launchItemRepository";
import { collectionRepository } from "../repositories/collectionRepository";
import { userRepository } from "../repositories/userRepository";
import { LaunchOfferType } from "../controllers/launchController";
import { nftMetaData, orderServices } from "./orderServices";
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
import { collectibleRepository } from "../repositories/collectibleRepository";
import { CustomError } from "../exceptions/CustomError";
import { Insertable } from "kysely";
import { Collectible, LaunchItem } from "../types/db/types";
import { EVM_CONFIG } from "../../blockchain/evm/evm-config";
import { TransactionConfirmationService } from "../../blockchain/evm/services/transactionConfirmationService";
import LaunchpadService from "../../blockchain/evm/services/launchpadService";
import MarketplaceService from "../../blockchain/evm/services/marketplaceService";
import { serializeBigInt } from "../../blockchain/evm/utils";
import { NextFunction } from "express";
import { FILE_COUNT_LIMIT } from "../libs/constants";
import {
  acquireSlot,
  forceReleaseSlot,
  updateProgress,
} from "../libs/uploadLimiter";

const launchPadService = new LaunchpadService(
  EVM_CONFIG.RPC_URL,
  new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS)
);

const confirmationService = new TransactionConfirmationService(
  EVM_CONFIG.RPC_URL!
);

export const launchServices = {
  create: async (
    data: any,
    files: Express.Multer.File[],
    totalFileCount: number,
    txid?: string
  ) => {
    const collection = await collectionRepository.getById(data.collectionId);
    if (!collection || !collection.layerId)
      throw new Error("Collection not found.");

    const layerType = await layerRepository.getById(collection.layerId);
    if (!layerType) throw new Error("Layer not found.");

    let launch = await launchRepository.getByCollectionId(collection.id);
    if (!launch) {
      launch = await launchRepository.create(data);
    }

    const totalBatches = Math.ceil(totalFileCount / FILE_COUNT_LIMIT);
    if (totalBatches < 1 || files.length < 1)
      throw new CustomError("Insufficient file count.", 400);

    const slotAcquired = await acquireSlot(collection.id, totalBatches);
    if (!slotAcquired) {
      throw new CustomError(
        "The upload system is at maximum capacity. Please wait a moment and try again.",
        400
      );
    }

    if (layerType.layer === "CITREA" && layerType.network === "TESTNET") {
      if (!txid) throw new Error("txid not found.");
      const transactionDetail = await confirmationService.getTransactionDetails(
        txid
      );

      if (transactionDetail.status !== 1) {
        throw new CustomError(
          "Transaction not confirmed. Please try again.",
          500
        );
      }

      if (!transactionDetail.deployedContractAddress) {
        throw new CustomError(
          "Transaction does not contain deployed contract address.",
          500
        );
      }

      await collectionRepository.update(collection.id, {
        contractAddress: transactionDetail.deployedContractAddress,
      });
    }

    const launchItemCount = await launchRepository.getCountByLaunchId(
      launch.id
    );
    const nftMetadatas: nftMetaData[] = [];
    let index = 0;
    for (let file of files) {
      let nftId = Number(launchItemCount) + index;

      nftMetadatas.push({
        name: `${collection?.name ?? "NFT"} #${nftId}`,
        nftId: nftId.toString(),
        ipfsUri: null,
        file: file,
      });

      index++;
    }

    let launchItems, insertableLaunchItems: Insertable<LaunchItem>[];
    try {
      insertableLaunchItems = await uploadFilesAndReturnLaunchItems(
        launch.id,
        nftMetadatas
      );
    } catch (e) {
      forceReleaseSlot(collection.id);
      throw e;
    }
    launchItems = await launchItemRepository.bulkInsert(insertableLaunchItems);

    let updatedCollection;
    const isComplete = await updateProgress(collection.id);
    if (isComplete) {
      updatedCollection = await collectionRepository.update(collection.id, {
        type: "LAUNCHED",
        supply: launchItemCount,
      });
    }

    return { launch, updatedCollection, launchItems, isComplete };
  },
  /*
    IF LAYER IS CITREA, generate money transfer hex
    RETURN the hex
  */
  // generateCitreaBuyHex: async (id: string, userId: string) => {
  //   const launch = await launchRepository.getById(id);
  //   if (!launch) throw new CustomError("Invalid launchId", 400);

  //   const launchItems = await launchItemRepository.getByLaunchId(id);

  //   //add validations(availibility, mintPerWallet, phases...)

  //   const issueDate = new Date();
  //   let mintPrice: number;

  //   if (launch.isWhitelisted && launch.wlStartsAt && launch.wlEndsAt) {
  //     if (
  //       launch.wlStartsAt < issueDate &&
  //       launch.wlEndsAt > issueDate &&
  //       launch.wlMintPrice
  //     ) {
  //       mintPrice = launch.wlMintPrice;
  //     }
  //   } else if (launch.poStartsAt < issueDate && launch.poEndsAt > issueDate) {
  //     mintPrice = launch.poMintPrice;
  //   }

  //   return { buyTxHex };
  // },
  generateOrderForLaunchedCollection: async (
    collectionId: string,
    issuerId: string,
    feeRate: number,
    launchOfferType: LaunchOfferType
  ) => {
    const user = await userRepository.getById(issuerId);
    if (!user) throw new Error("User not found.");

    const layer = await layerRepository.getById(user.layerId!);
    if (!layer) throw new Error("Layer not found.");

    const collection = await collectionRepository.getLaunchedCollectionById(
      collectionId
    );
    if (!collection) throw new Error("Collection not found.");

    const launch = await launchRepository.getByCollectionId(collection.id);
    if (!launch) throw new Error("Launch not found.");

    //TODO: add phase validation
    const userPurchaseCount =
      await purchaseRepository.getCountByUserIdAndLaunchId(launch.id, user.id);
    if (userPurchaseCount && userPurchaseCount >= launch.poMaxMintPerWallet)
      throw new CustomError("Wallet limit has been reached.", 400);

    const launchItem = await launchItemRepository.getRandomItemByLauchId(
      launch.id
    );
    const pickedLaunchItem = await launchItemRepository.setOnHoldById(
      launchItem.id,
      user.id
    );
    console.log("🚀 ~ pickedLaunchItem:", pickedLaunchItem);
    const file = await getObjectFromS3(pickedLaunchItem.fileKey);

    if (layer.layer === "CITREA" && layer.network === "TESTNET") {
      const collection = await collectionRepository.getById(collectionId);

      if (!collection || !collection.contractAddress)
        throw new Error("Contract address not found.");

      const unsignedTx =
        await launchPadService.getUnsignedLaunchMintTransaction(
          pickedLaunchItem,
          user.address,
          collection.contractAddress
        );

      const serializedTx = serializeBigInt(unsignedTx);
      const singleMintTxHex = serializedTx;

      const serviceFee = singleMintTxHex.value / 10 ** 18;
      const networkFee = singleMintTxHex.gasLimit / 10 ** 9;
      const fundingAmount = networkFee + serviceFee;

      const order = await orderRepository.create({
        userId: issuerId,
        collectionId: collectionId,
        quantity: 1,
        feeRate,
        orderType: "LAUNCH",
        serviceFee: serviceFee,
        networkFee: networkFee,
        fundingAmount: fundingAmount,
      });

      // const purchase = await purchaseRepository.create({
      //   userId: issuerId,
      //   orderId: order.id,
      //   launchItemId: pickedLaunchItem.id,
      // });

      return { order: order, launchedItem: pickedLaunchItem, singleMintTxHex };
    } else if (layer.layer === "FRACTAL" && layer.network === "TESTNET") {
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
        serviceFee: estimatedFee.serviceFee,
        networkFee: estimatedFee.networkFee,
        fundingAmount: estimatedFee.totalAmount,
      });

      // const purchase = await purchaseRepository.create({
      //   userId: issuerId,
      //   orderId: order.id,
      //   launchItemId: pickedLaunchItem.id,
      // });

      return {
        order: order,
        launchedItem: pickedLaunchItem,
        singleMintTxHex: null,
      };
    } else throw new CustomError("This layer is unsupported ATM.", 400);
  },
  mintPickedCollection: async (
    orderId: string,
    launchItemId: string,
    issuerId: string,
    txid: string
  ) => {
    const user = await userRepository.getById(issuerId);
    if (!user) throw new Error("User not found.");
    if (!user.layerId) throw new Error("User not found.");

    const layer = await layerRepository.getById(user.layerId);
    if (!layer) throw new Error("Layer not found.");

    const order = await orderRepository.getById(orderId);
    if (!order) throw new Error("Order not found.");

    const collection = await collectionRepository.getLaunchedCollectionById(
      order.collectionId!
    );
    if (!collection) throw new Error("Collection not found.");

    if (order.orderStatus !== "PENDING")
      throw new Error("Order is not pending.");

    const isLaunchItemOnHold = await launchItemRepository.getOnHoldById(
      launchItemId
    );
    if (isLaunchItemOnHold && isLaunchItemOnHold.onHoldBy !== user.id)
      throw new CustomError(
        "This launch item is currently reserved to another user.",
        400
      );

    const launchItem = await launchItemRepository.getById(launchItemId);
    if (!launchItem) throw new CustomError("Launch item not found.", 400);

    const file = await getObjectFromS3(launchItem.fileKey);

    if (layer?.layer === "CITREA" && layer.network === "TESTNET") {
      if (!launchItem.evmAssetId) throw new Error("Launch item not found.");
      if (!txid) throw new Error("txid not found.");

      const transactionDetail = await confirmationService.getTransactionDetails(
        txid
      );
      if (transactionDetail.status !== 1) {
        throw new CustomError(
          "Transaction not confirmed. Please try again.",
          500
        );
      }

      if (
        (collection?.type === "UNCONFIRMED" ||
          collection?.type === "LAUNCHED") &&
        order.collectionId
      )
        await collectionRepository.update(order.collectionId, {
          type: "MINTED",
        });

      await launchItemRepository.update(launchItem.id, { status: "SOLD" });

      const collectible = await collectibleRepository.create({
        collectionId: collection.id,
        uniqueIdx: `${collection.contractAddress}i${launchItem.evmAssetId}`,
        name: launchItem.name,
        fileKey: launchItem.fileKey,
      });

      await orderRepository.update(orderId, {
        paidAt: new Date(),
        orderStatus: "DONE",
      });

      await purchaseRepository.create({
        userId: user.id,
        launchItemId: launchItem.id,
      });

      return { commitTxId: null, revealTxId: null, collectible };
    } else if (layer?.layer === "FRACTAL" && layer.network === "TESTNET") {
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
      if (!order.fundingAddress || !order.privateKey)
        throw new CustomError("No funding address & private key found.", 400);

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

      const commitTxId = await sendRawTransactionWithNode(
        mintHexes!.commitTxHex
      );
      console.log(`Commit transaction sent: ${commitTxId}`);
      const revealTxId = await sendRawTransactionWithNode(
        mintHexes!.revealTxHex
      );
      console.log(`Reveal transaction sent: ${revealTxId}`);

      if (collection && collection.id) {
        if (collection?.type === "UNCONFIRMED" && order.collectionId)
          await collectionRepository.update(order.collectionId, {
            type: "MINTED",
          });
      }

      await orderRepository.update(orderId, {
        paidAt: new Date(),
        orderStatus: "DONE",
      });

      await launchItemRepository.update(launchItem.id, { status: "SOLD" });

      const collectible = await collectibleRepository.create({
        fileKey: launchItem.fileKey,
        name: `${collection.name} #${collection.mintedAmount}`,
        collectionId: collection.id,
        uniqueIdx: `${revealTxId}i0`,
      });

      await purchaseRepository.create({
        userId: user.id,
        launchItemId: launchItem.id,
      });

      return { commitTxId, revealTxId, collectible };
    } else throw new CustomError("This layer is unsupported ATM.", 400);
  },
};

// async function createLaunchItems(
//   launchId: string,
//   nftMetadatas: nftMetaData[]
// ): Promise<any[]> {
//   return await Promise.all(
//     nftMetadatas.map(async (metadata) => {
//       const key = randomUUID();
//       if (metadata.file) await uploadToS3(key, metadata.file);
//       return await launchItemRepository.create({
//         launchId,
//         fileKey: key,
//         evmAssetId: metadata.nftId,
//         name: metadata.name,
//       });
//     })
//   );
// }

async function uploadFilesAndReturnLaunchItems(
  launchId: string,
  nftMetadatas: nftMetaData[]
): Promise<Insertable<LaunchItem>[]> {
  return await Promise.all(
    nftMetadatas.map(async (metadata) => {
      const key = randomUUID();
      if (metadata.file) await uploadToS3(key, metadata.file);
      return {
        launchId,
        fileKey: key,
        evmAssetId: metadata.nftId,
        name: metadata.name,
      };
    })
  );
}
