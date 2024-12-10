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
import { Insertable, Updateable } from "kysely";
import { Collectible, Launch, LaunchItem } from "../types/db/types";
import { EVM_CONFIG } from "../../blockchain/evm/evm-config";
import { TransactionConfirmationService } from "../../blockchain/evm/services/transactionConfirmationService";
// import LaunchpadService from "../../blockchain/evm/services/launchpadService";
import MarketplaceService from "../../blockchain/evm/services/marketplaceService";
import { FILE_COUNT_LIMIT } from "../libs/constants";
import { db } from "../utils/db";
import logger from "../config/winston";
import {
  ipfsNftParams,
  recursiveInscriptionParams,
} from "../controllers/collectibleController";
import { collectibleServices } from "./collectibleServices";

// const launchPadService = new LaunchpadService(
//   EVM_CONFIG.RPC_URL,
//   new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS)
// );

const confirmationService = new TransactionConfirmationService(
  EVM_CONFIG.RPC_URL!
);

export const launchServices = {
  create: async (
    userId: string,
    userLayerId: string,
    data: Insertable<Launch>,
    txid: string,
    totalFileSize?: number,
    feeRate?: number
  ) => {
    const collection = await collectionRepository.getById(
      db,
      data.collectionId
    );
    if (!collection) throw new CustomError("Invalid collectionId.", 400);
    if (collection?.type === "SYNTHETIC")
      throw new CustomError("Invalid collection type.", 400);
    if (collection.creatorId !== userId)
      throw new CustomError("You are not the creator of this collection.", 400);

    const layerType = await layerRepository.getById(collection.layerId);
    if (!layerType) throw new CustomError("Layer not found.", 400);

    const user = await userRepository.getByUserLayerId(userLayerId);
    if (!user) throw new CustomError("Invalid user layer.", 400);
    if (!user?.isActive)
      throw new CustomError("This account is deactivated.", 400);
    if (user.id !== userId || data.userLayerId !== userLayerId)
      throw new CustomError(
        "You are not allowed to create launch for this account.",
        400
      );

    if (layerType.layer === "CITREA" && layerType.network === "TESTNET") {
      //TODO: add validation to check if userId is the creator of the collection
      if (!txid) throw new CustomError("txid not found.", 400);
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

      await collectionRepository.update(db, collection.id, {
        contractAddress: transactionDetail.deployedContractAddress,
      });
    }

    let order;
    if (collection.type === "RECURSIVE_INSCRIPTION") {
      if (!feeRate || feeRate < 1)
        throw new CustomError("Invalid fee rate.", 400);
      if (!totalFileSize)
        throw new CustomError(
          "Please provide an total file size of the recursive traits.",
          400
        );

      const funder = createFundingAddress("BITCOIN", "TESTNET");
      if (!totalFileSize)
        throw new CustomError(
          "Please provide an totalFileSize or totalTraitCount",
          400
        );

      let inscriptionFee = Math.min(totalFileSize * Number(feeRate), 0.00001);
      let mintFee = 0,
        serviceFee = 0;
      let totalAmount = inscriptionFee + mintFee + serviceFee;
      order = await orderRepository.create(db, {
        userId: userId,
        fundingAmount: totalAmount,
        fundingAddress: funder.address,
        privateKey: funder.privateKey,
        orderType: "MINT_COLLECTIBLE",
        collectionId: collection.id,
        feeRate: feeRate,
        userLayerId,
      });
    }

    const launch = await launchRepository.create(db, data);

    return { launch, order };
  },
  createInscriptionAndLaunchItemInBatch: async (
    userId: string,
    collectionId: string,
    names: string[],
    files: Express.Multer.File[],
    isLastBatch: boolean
  ) => {
    const collection = await collectionRepository.getById(db, collectionId);
    if (collection?.type !== "INSCRIPTION")
      throw new CustomError("Invalid collection type.", 400);
    if (collection.creatorId !== userId)
      throw new CustomError("You are not the creator of this collection.", 400);

    const launch = await launchRepository.getByCollectionId(collectionId);
    if (!launch) throw new CustomError("Launch not found.", 400);

    const collectibles = await collectibleServices.createInscriptions(
      collectionId,
      names,
      files
    );

    const launchItemsData: Insertable<LaunchItem>[] = [];
    for (let i = 0; i < collectibles.length; i++)
      launchItemsData.push({
        collectibleId: collectibles[i].id,
        launchId: launch.id,
      });
    const launchItems = await launchItemRepository.bulkInsert(
      db,
      launchItemsData
    );

    if (isLastBatch) {
      //TODO: ADD LAUNCHITEM.COUNT > 0 VALIDATION
      await launchRepository.update(launch.id, { status: "CONFIRMED" });
    }

    return { collectibles, launchItems };
  },
  createRecursiveInscriptionAndLaunchItemInBatch: async (
    userId: string,
    collectionId: string,
    data: recursiveInscriptionParams[],
    isLastBatch: boolean
  ) => {
    const collection = await collectionRepository.getById(db, collectionId);
    if (collection?.type !== "RECURSIVE_INSCRIPTION")
      throw new CustomError("Invalid collection type.", 400);
    if (collection.creatorId !== userId)
      throw new CustomError("You are not the creator of this collection.", 400);

    const launch = await launchRepository.getByCollectionId(collectionId);
    if (!launch) throw new CustomError("Launch not found.", 400);

    //TODO: Add validation to check if order.fundingAddress was funded(>=order.fundingAmount) or not
    const isPaid = true;
    if (!isPaid)
      throw new CustomError("Fee has not been transferred yet.", 400);

    const result = await collectibleServices.createRecursiveInscriptions(
      collectionId,
      data
    );

    const launchItemsData: Insertable<LaunchItem>[] = [];
    for (let i = 0; i < result.collectibles.length; i++)
      launchItemsData.push({
        collectibleId: result.collectibles[i].id,
        launchId: launch.id,
      });
    const launchItems = await launchItemRepository.bulkInsert(
      db,
      launchItemsData
    );

    if (isLastBatch) {
      //TODO: ADD LAUNCHITEM.COUNT > 0 VALIDATION
      await launchRepository.update(launch.id, { status: "CONFIRMED" });
      //TODO: CREATE INVOKE THE RECURSIVE TRAIT MINTING
      // GET ORDERID BY THE LAUNCH.COLLECTIONID
    }

    return {
      collectibles: result.collectibles,
      collectibleTraits: result.collectibleTraits,
      launchItems,
    };
  },
  createIpfsNftAndLaunchItemInBatch: async (
    userId: string,
    collectionId: string,
    data: ipfsNftParams[],
    isLastBatch: boolean
  ) => {
    const collection = await collectionRepository.getById(db, collectionId);
    if (collection?.type !== "IPFS")
      throw new CustomError("Invalid collection type.", 400);
    if (collection.creatorId !== userId)
      throw new CustomError("You are not the creator of this collection.", 400);

    const launch = await launchRepository.getByCollectionId(collectionId);
    if (!launch) throw new CustomError("Launch not found.", 400);

    const collectibles = await collectibleServices.createIpfsNfts(
      collectionId,
      data
    );

    const launchItemsData: Insertable<LaunchItem>[] = [];
    for (let i = 0; i < collectibles.length; i++)
      launchItemsData.push({
        collectibleId: collectibles[i].id,
        launchId: launch.id,
      });
    const launchItems = await launchItemRepository.bulkInsert(
      db,
      launchItemsData
    );

    if (isLastBatch) {
      //TODO: ADD LAUNCHITEM.COUNT > 0 VALIDATION
      await launchRepository.update(launch.id, { status: "CONFIRMED" });
    }

    return { collectibles, launchItems };
  },
  buy: async (
    userId: string,
    userLayerId: string,
    id: string,
    feeRate?: number
  ) => {
    const user = await userRepository.getByUserLayerId(userLayerId);
    if (!user) throw new CustomError("User not found.", 400);
    if (user.id !== userId)
      throw new CustomError(
        "You are not allowed to buy from this account.",
        400
      );
    if (!user?.isActive)
      throw new CustomError("This account is deactivated.", 400);

    const launch = await launchRepository.getById(id);
    if (!launch) throw new CustomError("Launch not found.", 400);
    const collection = await collectionRepository.getById(
      db,
      launch.collectionId
    );
    if (!collection) throw new CustomError("Collection not found.", 400);
    if (collection.type === "SYNTHETIC")
      throw new CustomError("You cannot buy the item of this collection.", 400);

    //TODO: add phase validation
    const userPurchaseCount =
      await purchaseRepository.getCountByUserIdAndLaunchId(launch.id, user.id);
    if (userPurchaseCount && userPurchaseCount >= launch.poMaxMintPerWallet)
      throw new CustomError("Wallet limit has been reached.", 400);

    const userOnHoldItemCount =
      await launchItemRepository.getOnHoldCountByLaunchIdAndUserId(
        launch.id,
        user.id
      );
    if (Number(userOnHoldItemCount) >= 3)
      throw new CustomError("You have too many items reserved.", 400);

    const launchItem = await launchItemRepository.getRandomItemByLauchId(
      launch.id
    );
    const pickedLaunchItem = await launchItemRepository.setOnHoldById(
      db,
      launchItem.id,
      user.id
    );
    const collectible = await collectibleRepository.getById(
      pickedLaunchItem.collectibleId
    );
    if (!collectible) throw new CustomError("Collectible not found.", 400);

    let unsignedTx, order;
    if (
      collection.type === "INSCRIPTION" ||
      collection.type === "RECURSIVE_INSCRIPTION"
    ) {
      if (!feeRate)
        throw new CustomError(
          "You must provide fee rate for this operation.",
          400
        );

      const funder = await createFundingAddress("BITCOIN", "TESTNET");
      const serviceFee = 0;
      const networkFee = 0.00001;
      const fundingAmount = networkFee + serviceFee;
      order = await orderRepository.create(db, {
        userId: user.id,
        collectionId: launch.collectionId,
        feeRate,
        orderType: "LAUNCH_BUY",
        fundingAmount: fundingAmount,
        fundingAddress: funder.address,
        privateKey: funder.privateKey,
        userLayerId,
      });
    } else if (collection.type === "IPFS") {
      if (!collection.contractAddress)
        throw new Error("Collection with no contract address not found.");

      //TODO: method for generating mint transaction tx by pickedLaunchItem.collectible.cid
      unsignedTx = null;
      // unsignedTx = await launchPadService.getUnsignedLaunchMintTransaction(
      //   collectible,
      //   user.address,
      //   collection.contractAddress,
      //   db
      // );
    }

    return { launchItem: pickedLaunchItem, order, unsignedTx };
  },
  confirmMint: async (
    userId: string,
    userLayerId: string,
    launchItemId: string,
    verification?: {
      txid?: string;
      orderId?: string;
    }
  ) => {
    const user = await userRepository.getByUserLayerId(userLayerId);
    if (!user) throw new CustomError("User not found.", 400);
    if (user.id !== userId)
      throw new CustomError(
        "You are not allowed to buy from this account.",
        400
      );
    if (!user?.isActive)
      throw new CustomError("This account is deactivated.", 400);

    const isLaunchItemOnHold = await launchItemRepository.getOnHoldById(
      launchItemId
    );
    if (!isLaunchItemOnHold)
      throw new CustomError("Launch item not found.", 400);
    if (isLaunchItemOnHold.status === "SOLD")
      throw new CustomError("Launch item has already been sold.", 400);
    if (isLaunchItemOnHold && isLaunchItemOnHold.onHoldBy !== user.id)
      throw new CustomError(
        "This launch item is currently reserved to another user.",
        400
      );

    const launch = await launchRepository.getById(isLaunchItemOnHold.launchId);
    if (!launch) throw new CustomError("Launch not found.", 400);
    const collection = await collectionRepository.getById(
      db,
      launch.collectionId
    );
    if (!collection) throw new CustomError("Collection not found.", 400);
    if (collection.type === "SYNTHETIC")
      throw new CustomError("You cannot buy the item of this collection.", 400);

    if (
      collection.type === "INSCRIPTION" ||
      collection.type === "RECURSIVE_INSCRIPTION"
    ) {
      if (!verification?.orderId)
        throw new CustomError(
          "You must provide orderId for this operation.",
          400
        );

      //TODO: Add validation to check if order.fundingAddress was funded(>=order.fundingAmount) or not
      const isPaid = true;
      if (!isPaid)
        throw new CustomError("Fee has not been transferred yet.", 400);

      //TODO: inscribe L1 ordinals by order.privateKey, mint L2 synthetic asset by vault
      await orderRepository.update(db, verification.orderId, {
        orderStatus: "DONE",
      });
    } else if (collection.type === "IPFS") {
      if (!verification?.txid)
        throw new CustomError(
          "You must provide mint txid for this operation.",
          400
        );

      const transactionDetail = await confirmationService.getTransactionDetails(
        verification.txid
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
    }

    if (launch.status === "UNCONFIRMED")
      await launchRepository.update(launch.id, { status: "CONFIRMED" });
    if (collection.status === "UNCONFIRMED")
      await collectionRepository.update(db, collection.id, {
        status: "CONFIRMED",
      });

    const launchItem = await launchItemRepository.update(
      db,
      isLaunchItemOnHold.id,
      {
        status: "SOLD",
      }
    );
    const collectible = await collectibleRepository.update(
      db,
      isLaunchItemOnHold.collectibleId,
      {
        status: "CONFIRMED",
      }
    );

    return { launchItem, collectible };
  },
  // create: async (
  //   data: any,
  //   files: Express.Multer.File[],
  //   totalFileCount: number,
  //   txid?: string
  // ) => {
  //   const collection = await collectionRepository.getById(
  //     db,
  //     data.collectionId
  //   );
  //   if (!collection || !collection.layerId)
  //     throw new CustomError("Collection not found.", 400);
  //   const layerType = await layerRepository.getById(collection.layerId);
  //   if (!layerType) throw new CustomError("Layer not found.", 400);
  //   const totalBatches = Math.ceil(totalFileCount / FILE_COUNT_LIMIT);
  //   if (totalBatches < 1 || files.length < 1)
  //     throw new CustomError("Insufficient file count.", 400);
  //   const slotAcquired = await acquireSlot(collection.id, totalBatches);
  //   if (!slotAcquired) {
  //     throw new CustomError(
  //       "The upload system is at maximum capacity. Please wait a moment and try again.",
  //       400
  //     );
  //   }
  //   let launch = await launchRepository.getByCollectionId(collection.id);
  //   return await db.transaction().execute(async (trx) => {
  //     if (layerType.layer === "CITREA" && layerType.network === "TESTNET") {
  //       if (!txid) throw new CustomError("txid not found.", 400);
  //       const transactionDetail =
  //         await confirmationService.getTransactionDetails(txid);
  //       if (transactionDetail.status !== 1) {
  //         throw new CustomError(
  //           "Transaction not confirmed. Please try again.",
  //           500
  //         );
  //       }
  //       if (!transactionDetail.deployedContractAddress) {
  //         throw new CustomError(
  //           "Transaction does not contain deployed contract address.",
  //           500
  //         );
  //       }
  //       await collectionRepository.update(trx, collection.id, {
  //         contractAddress: transactionDetail.deployedContractAddress,
  //       });
  //     }
  //     if (!launch) launch = await launchRepository.create(trx, data);
  //     const launchItemCount = await launchRepository.getCountByLaunchId(
  //       trx,
  //       launch.id
  //     );
  //     const nftMetadatas: nftMetaData[] = [];
  //     let index = 0;
  //     for (let file of files) {
  //       let nftId = Number(launchItemCount) + index;
  //       nftMetadatas.push({
  //         name: `${collection?.name ?? "NFT"} #${nftId}`,
  //         nftId: nftId.toString(),
  //         ipfsUri: null,
  //         file: file,
  //       });
  //       index++;
  //     }
  //     let launchItems, insertableLaunchItems: Insertable<LaunchItem>[];
  //     try {
  //       insertableLaunchItems = await uploadFilesAndReturnLaunchItems(
  //         launch.id,
  //         nftMetadatas
  //       );
  //     } catch (e) {
  //       forceReleaseSlot(collection.id);
  //       throw e;
  //     }
  //     //TODO: metadata support
  //     launchItems = await launchItemRepository.bulkInsert(
  //       trx,
  //       insertableLaunchItems
  //     );
  //     let updatedCollection;
  //     const isComplete = await updateProgress(collection.id);
  //     if (isComplete) {
  //       updatedCollection = await collectionRepository.update(
  //         trx,
  //         collection.id,
  //         {
  //           supply: 0,
  //         }
  //       );
  //     }
  //     return { launch, updatedCollection, launchItems, isComplete };
  //   });
  // },
  // generateOrderForLaunchedCollection: async (
  //   collectionId: string,
  //   feeRate: number,
  //   launchOfferType: LaunchOfferType,
  //   issuerId: string,
  //   userLayerId: string
  // ) => {
  //   const collection = await collectionRepository.getLaunchedCollectionById(
  //     collectionId
  //   );
  //   if (!collection) throw new CustomError("Collection not found.", 400);
  //   const user = await userRepository.getByIdAndLayerId(
  //     issuerId,
  //     collection.layerId
  //   );
  //   if (!user) throw new CustomError("User not found.", 400);
  //   const launch = await launchRepository.getByCollectionId(collection.id);
  //   if (!launch) throw new CustomError("Launch not found.", 400);
  //   const currentUnixTimestamp = Date.now() / 1000;
  //   if (
  //     Number(launch.poStartsAt) > Number(currentUnixTimestamp) ||
  //     (launch.poEndsAt &&
  //       Number(launch.poEndsAt) < Number(currentUnixTimestamp))
  //   )
  //     throw new CustomError(
  //       "Either launch has ended or has not started yet.",
  //       400
  //     );
  //   //TODO: add phase validation
  //   const userPurchaseCount =
  //     await purchaseRepository.getCountByUserIdAndLaunchId(launch.id, user.id);
  //   if (userPurchaseCount && userPurchaseCount >= launch.poMaxMintPerWallet)
  //     throw new CustomError("Wallet limit has been reached.", 400);
  //   const userOnHoldItemCount =
  //     await launchItemRepository.getOnHoldCountByLaunchIdAndUserId(
  //       launch.id,
  //       user.id
  //     );
  //   if (Number(userOnHoldItemCount) >= 3)
  //     throw new CustomError("You have too many items reserved.", 400);
  //   const launchItem = await launchItemRepository.getRandomItemByLauchId(
  //     launch.id
  //   );
  //   return await db.transaction().execute(async (trx) => {
  //     const pickedLaunchItem = await launchItemRepository.setOnHoldById(
  //       trx,
  //       launchItem.id,
  //       user.id
  //     );
  //     const file = await getObjectFromS3(pickedLaunchItem.fileKey);
  //     if (user.layer === "CITREA" && user.network === "TESTNET") {
  //       const collection = await collectionRepository.getById(
  //         trx,
  //         collectionId
  //       );
  //       if (!collection) throw new CustomError("Collection not found.", 400);
  //       if (!collection.contractAddress)
  //         throw new Error("Collection with no contract address not found.");
  //       const unsignedTx =
  //         await launchPadService.getUnsignedLaunchMintTransaction(
  //           pickedLaunchItem,
  //           user.address,
  //           collection.contractAddress,
  //           trx
  //         );
  //       //TODO: metadata support
  //       const serializedTx = serializeBigInt(unsignedTx);
  //       const singleMintTxHex = serializedTx;
  //       const serviceFee = singleMintTxHex.value / 10 ** 18;
  //       const networkFee = singleMintTxHex.gasLimit / 10 ** 9;
  //       const fundingAmount = networkFee + serviceFee;
  //       const order = await orderRepository.create(trx, {
  //         userId: issuerId,
  //         collectionId: collectionId,
  //         feeRate,
  //         orderType: "LAUNCH_BUY",
  //         fundingAmount: fundingAmount,
  //         userLayerId: "",
  //       });
  //       return {
  //         order: order,
  //         launchedItem: pickedLaunchItem,
  //         singleMintTxHex,
  //       };
  //     } else if (user.layer === "FRACTAL" && user.network === "TESTNET") {
  //       const { estimatedFee } = getEstimatedFee(
  //         [(file.content as Buffer).length],
  //         [file.contentType!.length],
  //         SERVICE_FEE[user.layer][user.network],
  //         feeRate,
  //         collection.poMintPrice
  //       );
  //       const funder = createFundingAddress(user.layer, user.network);
  //       const order = await orderRepository.create(trx, {
  //         userId: issuerId,
  //         collectionId: collectionId,
  //         feeRate,
  //         orderType: "LAUNCH_BUY",
  //         fundingAmount: estimatedFee.totalAmount,
  //         userLayerId,
  //       });
  //       return {
  //         order: order,
  //         launchedItem: pickedLaunchItem,
  //         singleMintTxHex: null,
  //       };
  //     } else throw new CustomError("This layer is unsupported ATM.", 400);
  //   });
  // },
  // mintPickedCollection: async (
  //   orderId: string,
  //   launchItemId: string,
  //   issuerId: string,
  //   txid: string
  // ) => {
  //   const order = await orderRepository.getById(orderId);
  //   if (!order) throw new CustomError("Order not found.", 400);
  //   if (order.userId !== issuerId)
  //     throw new CustomError("This order does not belong to you.", 400);
  //   if (order.orderStatus !== "PENDING")
  //     throw new CustomError("Order is not pending.", 400);
  //   const collection = await collectionRepository.getLaunchedCollectionById(
  //     order.collectionId!
  //   );
  //   if (!collection) throw new CustomError("Collection not found.", 400);
  //   const user = await userRepository.getByIdAndLayerId(
  //     issuerId,
  //     collection.layerId
  //   );
  //   if (!user) throw new CustomError("User not found.", 400);
  //   if (!user.layerId) throw new CustomError("Layer not found.", 400);
  //   const isLaunchItemOnHold = await launchItemRepository.getOnHoldById(
  //     launchItemId
  //   );
  //   if (isLaunchItemOnHold && isLaunchItemOnHold.onHoldBy !== user.id)
  //     throw new CustomError(
  //       "This launch item is currently reserved to another user.",
  //       400
  //     );
  //   const launchItem = await launchItemRepository.getById(launchItemId);
  //   if (!launchItem) throw new CustomError("Launch item not found.", 400);
  //   const file = await getObjectFromS3(launchItem.fileKey);
  //   return await db.transaction().execute(async (trx) => {
  //     if (user.layer === "CITREA" && user.network === "TESTNET") {
  //       if (!launchItem.evmAssetId)
  //         throw new CustomError("Launch item with no asset id.", 400);
  //       if (!txid) throw new CustomError("txid not found.", 400);
  //       const transactionDetail =
  //         await confirmationService.getTransactionDetails(txid);
  //       if (transactionDetail.status !== 1) {
  //         throw new CustomError(
  //           "Transaction not confirmed. Please try again.",
  //           500
  //         );
  //       }
  //       if (collection.status === "UNCONFIRMED" && order.collectionId)
  //         await collectionRepository.update(trx, order.collectionId, {
  //           status: "CONFIRMED",
  //         });
  //       await launchItemRepository.update(trx, launchItem.id, {
  //         status: "SOLD",
  //         mintingTxId: txid,
  //       });
  //       //TODO: metadata support
  //       const collectible = await collectibleRepository.create(trx, {
  //         collectionId: collection.id,
  //         uniqueIdx: `${collection.contractAddress}i${launchItem.evmAssetId}`,
  //         name: launchItem.name,
  //         fileKey: launchItem.fileKey,
  //         mintingTxId: txid,
  //       });
  //       await orderRepository.update(trx, orderId, {
  //         paidAt: new Date(),
  //         orderStatus: "DONE",
  //         mintedAt: txid,
  //       });
  //       await purchaseRepository.create(trx, {
  //         userId: user.id,
  //         launchItemId: launchItem.id,
  //       });
  //       await collectionRepository.incrementCollectionSupplyById(
  //         trx,
  //         collection.id
  //       );
  //       return { commitTxId: null, revealTxId: null, collectible };
  //     } else if (user.layer === "FRACTAL" && user.network === "TESTNET") {
  //       const tokenData = {
  //         address: user.address,
  //         xpub: null,
  //         opReturnValues: `data:${file.contentType};base64,${(
  //           file.content as Buffer
  //         ).toString("base64")}` as any,
  //         assetType: ASSETTYPE.NFTOFFCHAIN,
  //         supply: 1,
  //         headline: "headline",
  //         ticker: "test",
  //       };
  //       if (!order.fundingAddress || !order.privateKey)
  //         throw new CustomError("No funding address & private key found.", 400);
  //       const mintHexes = await mint(
  //         tokenData,
  //         order.fundingAddress,
  //         order.privateKey,
  //         true,
  //         SERVICE_FEE_ADDRESS["FRACTAL"]["MAINNET"],
  //         SERVICE_FEE["FRACTAL"]["MAINNET"],
  //         order.feeRate,
  //         "bc1pffk5397d7sns6mayud03nf3fxy4p04e3alhslr6epaq3a788tsuqkxg0rn", // TODO. Collection Owner address bolgoh
  //         collection.poMintPrice
  //       );
  //       const commitTxId = await sendRawTransactionWithNode(
  //         mintHexes!.commitTxHex
  //       );
  //       logger.info(`Commit transaction sent: ${commitTxId}`);
  //       const revealTxId = await sendRawTransactionWithNode(
  //         mintHexes!.revealTxHex
  //       );
  //       logger.info(`Reveal transaction sent: ${revealTxId}`);
  //       if (collection && collection.id) {
  //         if (collection?.status === "UNCONFIRMED" && order.collectionId)
  //           await collectionRepository.update(trx, order.collectionId, {
  //             status: "CONFIRMED",
  //           });
  //       }
  //       await orderRepository.update(trx, orderId, {
  //         paidAt: new Date(),
  //         orderStatus: "DONE",
  //       });
  //       await launchItemRepository.update(trx, launchItem.id, {
  //         status: "SOLD",
  //         mintingTxId: txid,
  //       });
  //       //TODO: metadata support
  //       const collectible = await collectibleRepository.create(trx, {
  //         fileKey: launchItem.fileKey,
  //         name: `${collection.name} #${collection.mintedAmount}`,
  //         collectionId: collection.id,
  //         uniqueIdx: `${revealTxId}i0`,
  //         mintingTxId: txid,
  //       });
  //       await purchaseRepository.create(trx, {
  //         userId: user.id,
  //         launchItemId: launchItem.id,
  //       });
  //       return { commitTxId, revealTxId, collectible };
  //     } else throw new CustomError("This layer is unsupported ATM.", 400);
  //   });
  // },
  // update: async (id: string, data: Updateable<Launch>, issuerId: string) => {
  //   const issuer = await userRepository.getByIdWithLayer(issuerId);
  //   if (!issuer) throw new CustomError("User not found.", 400);
  //   const launch = await launchRepository.getById(id);
  //   if (!launch) throw new CustomError("Launch not found.", 400);
  //   if (launch.ownerId !== issuerId)
  //     throw new CustomError(
  //       "You are not allowed to update this collection.",
  //       400
  //     );
  //   let updateTxHex;
  //   if (issuer.layer === "CITREA") {
  //     //update the data in the contract
  //   }
  //   const updatedLaunch = await launchRepository.update(id, data);
  //   return { updatedLaunch, updateTxHex };
  // },
};

// async function uploadFilesAndReturnLaunchItems(
//   launchId: string,
//   nftMetadatas: nftMetaData[]
// ): Promise<Insertable<LaunchItem>[]> {
//   return await Promise.all(
//     nftMetadatas.map(async (metadata) => {
//       const key = randomUUID();
//       if (metadata.file) await uploadToS3(key, metadata.file);
//       return {
//         launchId,
//         fileKey: key.toString(),
//         evmAssetId: metadata.nftId,
//         name: metadata.name,
//       };
//     })
//   );
// }
