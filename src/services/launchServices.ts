import { randomUUID } from "crypto";
import { launchRepository } from "../repositories/launchRepository";
import { Launch } from "@prisma/client";
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
import { Collectible } from "../types/db/types";
import { EVM_CONFIG } from "../../blockchain/evm/evm-config";
import { TransactionConfirmationService } from "../../blockchain/evm/services/transactionConfirmationService";
import LaunchpadService from "../../blockchain/evm/services/launchpadService";
import MarketplaceService from "../../blockchain/evm/services/marketplaceService";
import { serializeBigInt } from "../../blockchain/evm/utils";
import { NextFunction } from "express";

const launchPadService = new LaunchpadService(
  EVM_CONFIG.RPC_URL,
  new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS)
);

const confirmationService = new TransactionConfirmationService(
  EVM_CONFIG.RPC_URL!
);

export const launchServices = {
  create: async (data: any, files: Express.Multer.File[], txid?: string) => {
    const collection = await collectionRepository.getById(data.collectionId);
    if (!collection || !collection.layerId)
      throw new Error("Collection not found.");

    const layerType = await layerRepository.getById(collection.layerId);
    if (!layerType) throw new Error("Layer not found.");

    if (collection.type === "LAUNCHED")
      throw new Error("Collection already launched.");

    if (files.length < 1)
      throw new Error("Launch must have at least one file.");

    const launch = await launchRepository.create(data);

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

      if (!collection || !collection.id)
        throw new Error("Collection not found.");
      await collectionRepository.update(collection.id, {
        contractAddress: transactionDetail.deployedContractAddress,
      });
    }

    const nftMetadatas: nftMetaData[] = [];
    let index = 0;
    for (let file of files) {
      const nftId = layerType.layer === "CITREA" ? index.toString() : null;
      nftMetadatas.push({
        name: `${collection?.name ?? "NFT"} #${index}`,
        nftId: nftId,
        ipfsUri: null,
        file: file,
      });

      index++;
    }

    console.log(nftMetadatas);

    const launchItems = await createLaunchItems(launch.id, nftMetadatas);

    const updatedCollection = await collectionRepository.update(collection.id, {
      type: "LAUNCHED",
      supply: collection.supply + launchItems.length,
    });

    return { launch, updatedCollection, launchItems };
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
    //TODO
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

    //TODO: add validations(mintPerWallet, phases...)
    const launchItem = await launchItemRepository.getRandomItemByLauchId(
      launch.id
    );
    const pickedLaunchItem = await launchItemRepository.setOnHoldById(
      launchItem.id
    );
    const file = await getObjectFromS3(pickedLaunchItem.fileKey);

    if (layer.layer === "CITREA" && layer.network === "TESTNET") {
      const serviceFee = 0;
      const networkFee = 0;
      const fundingAmount = 0;

      const order = await orderRepository.create({
        userId: issuerId,
        collectionId: collectionId,
        quantity: 1,
        feeRate,
        orderType: "LAUNCH",
        fundingAddress: "",
        privateKey: "",
        serviceFee: serviceFee,
        networkFee: networkFee,
        fundingAmount: fundingAmount,
      });

      const purchase = await purchaseRepository.create({
        userId: issuerId,
        orderId: order.id,
        launchItemId: pickedLaunchItem.id,
      });

      const collection = await collectionRepository.getById(collectionId);

      if (!collection || !collection.contractAddress)
        throw new Error("Contract address not found.");

      console.log(collection.contractAddress);
      console.log(issuerId);
      const unsignedTx =
        await launchPadService.getUnsignedLaunchMintTransaction(
          // launch,
          pickedLaunchItem,
          user.address,
          collection.contractAddress
        );

      const serializedTx = serializeBigInt(unsignedTx);

      const singleMintTxHex = serializedTx;

      return { order: order, launchedItem: pickedLaunchItem, singleMintTxHex };
    } else if (layer.layer === "FRACTAL" && layer.network === "TESTNET") {
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
            launchItemId: pickedLaunchItem.id,
          });

          return { order: order, launchedItem: pickedLaunchItem };

        case "whitelist":
          //TODO
          break;
        default:
          throw new Error("Invalid launch offer type.");
      }
    } else throw new CustomError("This layer is unsupported ATM.", 400);
  },
  mintPickedCollection: async (
    orderId: string,
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

    const purchase = await purchaseRepository.getByOrderId(orderId);
    if (!purchase) throw new Error("Order has not been created yet.");

    if (order.orderStatus !== "PENDING")
      throw new Error("Order is not pending.");

    const launchItem = await launchItemRepository.getById(
      purchase.launchItemId
    );
    console.log(launchItem);
    if (!launchItem) throw new Error("Launch item not found.");

    const file = await getObjectFromS3(launchItem.fileKey);

    if (layer?.layer === "CITREA" && layer.network === "TESTNET") {
      if (!launchItem.evmAssetId) throw new Error("Launch item not found.");

      /*
        IF LAYER IS CITREA, validate mint TXID
        sets the collection(if its first mint of that transaction) & launchItem status to CONFIRMED
        creates collectible
        returns {collectible?, commitTxId, revealTxId}
      */
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

      if (collection && collection.id) {
        if (collection?.type === "UNCONFIRMED" && order.collectionId)
          await collectionRepository.update(order.collectionId, {
            type: "MINTED",
          });
      }

      await launchItemRepository.update(launchItem.id, { status: "SOLD" });

      const collectible = await collectibleRepository.create({
        collectionId: collection.id,
        uniqueIdx: launchItem.evmAssetId,
        name: launchItem.name,
        fileKey: launchItem.fileKey,
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

      return { commitTxId, revealTxId, collectible };
    } else throw new CustomError("This layer is unsupported ATM.", 400);
  },
};

async function createLaunchItems(
  launchId: string,
  nftMetadatas: nftMetaData[]
): Promise<any[]> {
  return await Promise.all(
    nftMetadatas.map(async (metadata) => {
      const key = randomUUID();
      if (metadata.file) await uploadToS3(key, metadata.file);
      return await launchItemRepository.create({
        launchId,
        fileKey: key,
        evmAssetId: metadata.nftId,
        name: metadata.name,
      });
    })
  );
}
