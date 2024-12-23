import { randomUUID } from "crypto";
import { launchRepository } from "../repositories/launchRepository";
import { getObjectFromS3, uploadToS3 } from "../utils/aws";
import { launchItemRepository } from "../repositories/launchItemRepository";
import { collectionRepository } from "../repositories/collectionRepository";
import { userRepository } from "../repositories/userRepository";
import { LaunchOfferType } from "../controllers/launchController";
import { nftMetaData, orderServices } from "./orderServices";
import { orderRepository } from "../repositories/orderRepostory";
import { layerRepository } from "../repositories/layerRepository";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { CustomError } from "../exceptions/CustomError";
import { Insertable, Updateable } from "kysely";
import { Collectible, Launch, LaunchItem, OrderItem } from "../types/db/types";
import { EVM_CONFIG } from "../../blockchain/evm/evm-config";
import { TransactionConfirmationService } from "../../blockchain/evm/services/transactionConfirmationService";
import LaunchpadService from "../../blockchain/evm/services/launchpadService";
import MarketplaceService from "../../blockchain/evm/services/marketplaceService";
import { FILE_COUNT_LIMIT } from "../libs/constants";
import { db } from "../utils/db";
import logger from "../config/winston";
import {
  ipfsNftParams,
  recursiveInscriptionParams,
} from "../controllers/collectibleController";
import { collectibleServices } from "./collectibleServices";
import { serializeBigInt } from "../../blockchain/evm/utils";
import { createFundingAddress } from "../blockchain/bitcoin/createFundingAddress";
import { purchaseRepository } from "../repositories/purchaseRepository";
import { getBalance, getEstimatedFee } from "../blockchain/bitcoin/libs";
import { GetObjectCommandOutput } from "@aws-sdk/client-s3";
import {
  COMMIT_TX_SIZE,
  REVEAL_TX_SIZE,
} from "../blockchain/bitcoin/constants";
import NFTService from "../../blockchain/evm/services/nftService";
import { inscribe } from "../blockchain/bitcoin/inscribe";
import { sendRawTransaction } from "../blockchain/bitcoin/sendTransaction";
import { hideSensitiveData } from "../libs/hideDataHelper";
import { orderItemRepository } from "../repositories/orderItemRepository";
import { producer } from "..";

const launchPadService = new LaunchpadService(
  EVM_CONFIG.RPC_URL,
  new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS)
);

const nftService = new NFTService(
  EVM_CONFIG.RPC_URL,
  EVM_CONFIG.MARKETPLACE_ADDRESS,
  new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS)
);

const confirmationService = new TransactionConfirmationService(
  EVM_CONFIG.RPC_URL!
);

export const launchServices = {
  create: async (
    userId: string,
    data: Insertable<Launch>,
    txid: string,
    totalFileSize?: number,
    totalTraitCount?: number,
    feeRate?: number
  ) => {
    const collection = await collectionRepository.getById(
      db,
      data.collectionId
    );
    if (!collection) throw new CustomError("Invalid collectionId.", 400);
    if (collection?.type === "SYNTHETIC" || collection.parentCollectionId)
      throw new CustomError("Invalid collection type.", 400);
    if (collection.creatorId !== userId)
      throw new CustomError("You are not the creator of this collection.", 400);

    const user = await userRepository.getByUserLayerId(data.userLayerId);
    if (!user) throw new CustomError("Invalid user layer.", 400);
    if (!user?.isActive)
      throw new CustomError("This account is deactivated.", 400);
    if (user.id !== userId || data.userLayerId !== data.userLayerId)
      throw new CustomError(
        "You are not allowed to create launch for this account.",
        400
      );

    const hasExistingOrder = await orderRepository.getByCollectionId(
      collection.id
    );
    if (hasExistingOrder)
      throw new CustomError(
        "This collection already has existing mint order.",
        400
      );

    const hasExistingLaunch = await launchRepository.getByCollectionId(
      collection.id
    );
    if (hasExistingLaunch)
      throw new CustomError(
        "This collection already has existing launch.",
        400
      );

    if (
      collection.type === "INSCRIPTION" ||
      collection.type === "RECURSIVE_INSCRIPTION"
    ) {
      const childCollection =
        await collectionRepository.getChildCollectionByParentCollectionId(
          collection.id
        );
      if (!childCollection)
        throw new CustomError(
          "Child collection must be recorded for this operation.",
          400
        );

      const layerType = await layerRepository.getById(childCollection.layerId);
      if (!layerType) throw new CustomError("Layer not found.", 400);

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

      await collectionRepository.update(db, childCollection.id, {
        contractAddress: transactionDetail.deployedContractAddress,
      });
    } else if (collection.type === "IPFS") {
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

      const funder = createFundingAddress("TESTNET");
      if (!totalFileSize || !totalTraitCount)
        throw new CustomError(
          "Please provide an totalFileSize or totalTraitCount",
          400
        );

      // let inscriptionFee = Math.min(totalFileSize * Number(feeRate), 0.00001);
      let networkFee =
        getEstimatedFee([10], [totalFileSize], 0, feeRate, 0).estimatedFee
          .totalAmount +
        feeRate * (COMMIT_TX_SIZE + REVEAL_TX_SIZE) * totalTraitCount;
      let serviceFee = 0;
      let totalAmount = networkFee * 1.5 + serviceFee;

      order = await orderRepository.create(db, {
        userId: userId,
        fundingAmount: totalAmount,
        fundingAddress: funder.address,
        privateKey: funder.privateKey,
        orderType: "MINT_COLLECTIBLE",
        collectionId: collection.id,
        feeRate: feeRate,
        userLayerId: data.userLayerId,
        createdAt: new Date().toISOString(),
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
    if (!collection) throw new CustomError("Invalid collectionId.", 400);
    if (collection?.type !== "INSCRIPTION")
      throw new CustomError("Invalid collection type.", 400);
    if (collection.creatorId !== userId)
      throw new CustomError("You are not the creator of this collection.", 400);

    const launch = await launchRepository.getByCollectionId(collectionId);
    if (!launch) throw new CustomError("Launch not found.", 400);
    if (launch.status === "CONFIRMED")
      throw new CustomError("This launch has already been confirmed.", 400);

    const existingLaunchItemCount =
      await launchRepository.getLaunchItemCountByLaunchId(db, launch.id);
    const collectibles = await collectibleServices.createInscriptions(
      collectionId,
      collection.name,
      names,
      Number(existingLaunchItemCount),
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
    if (!collection) throw new CustomError("Invalid collectionId.", 400);
    if (collection?.type !== "RECURSIVE_INSCRIPTION")
      throw new CustomError("Invalid collection type.", 400);
    if (collection.creatorId !== userId)
      throw new CustomError("You are not the creator of this collection.", 400);

    const launch = await launchRepository.getByCollectionId(collectionId);
    if (!launch) throw new CustomError("Launch not found.", 400);
    if (launch.status === "CONFIRMED")
      throw new CustomError("This launch has already been confirmed.", 400);

    //TODO: Add validation to check if order.fundingAddress was funded(>=order.fundingAmount) or not
    const isPaid = true;
    if (!isPaid)
      throw new CustomError("Fee has not been transferred yet.", 400);

    const existingLaunchItemCount =
      await launchRepository.getLaunchItemCountByLaunchId(db, launch.id);
    const result = await collectibleServices.createRecursiveInscriptions(
      collectionId,
      Number(existingLaunchItemCount),
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
      // await launchRepository.update(launch.id, { status: "CONFIRMED" });
      //TODO: INVOKE THE RECURSIVE TRAIT MINTING, GET ORDERID BY THE LAUNCH.COLLECTIONID
      // CONFIRM THE LAUNCH AFTER MINTING THE LAST TRAIT OF THE COLLECTION
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
    if (!collection) throw new CustomError("Invalid collectionId.", 400);
    if (collection?.type !== "IPFS")
      throw new CustomError("Invalid collection type.", 400);
    if (collection.creatorId !== userId)
      throw new CustomError("You are not the creator of this collection.", 400);

    const launch = await launchRepository.getByCollectionId(collectionId);
    if (!launch) throw new CustomError("Launch not found.", 400);
    if (launch.status === "CONFIRMED")
      throw new CustomError("This launch has already been confirmed.", 400);

    const existingLaunchItemCount =
      await launchRepository.getLaunchItemCountByLaunchId(db, launch.id);
    const collectibles = await collectibleServices.createIpfsNfts(
      collection,
      Number(existingLaunchItemCount),
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
    if (launch.status === "UNCONFIRMED")
      throw new CustomError("Unconfirmed launch.", 400);

    const collection = await collectionRepository.getById(
      db,
      launch.collectionId
    );
    if (!collection) throw new CustomError("Collection not found.", 400);
    if (collection?.type === "SYNTHETIC" || collection.parentCollectionId)
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
    const result = await db.transaction().execute(async (trx) => {
      const pickedLaunchItem = await launchItemRepository.setOnHoldById(
        trx,
        launchItem.id,
        user.id
      );
      const collectible = await collectibleRepository.getById(
        launchItem.collectibleId
      );
      if (!collectible) throw new CustomError("Collectible not found.", 400);

      let singleMintTxHex, order;
      if (
        collection.type === "INSCRIPTION" ||
        collection.type === "RECURSIVE_INSCRIPTION"
      ) {
        if (!feeRate)
          throw new CustomError(
            "You must provide fee rate for this operation.",
            400
          );

        let networkFee: number = 546,
          file;
        if (collection.type === "RECURSIVE_INSCRIPTION") {
          //TODO: Validate if all traits of the collection has already been minted or not
          //networkFee = calculateRecursiveInscriptionGasFee(traitCount: number)
        }

        if (collection.type === "INSCRIPTION" && collectible.fileKey) {
          file = await getObjectFromS3(collectible.fileKey);
          networkFee =
            getEstimatedFee(
              [Number(file.contentType?.length)],
              [Number(file.contentLength)],
              0,
              feeRate,
              0
            ).estimatedFee.totalAmount +
            feeRate * (COMMIT_TX_SIZE + REVEAL_TX_SIZE);
        }

        const funder = await createFundingAddress("TESTNET");
        const serviceFee = 0;
        let totalAmount = networkFee * 1.5 + serviceFee;
        order = await orderRepository.create(trx, {
          userId: user.id,
          collectionId: launch.collectionId,
          feeRate,
          orderType: "LAUNCH_BUY",
          fundingAmount: totalAmount,
          fundingAddress: funder.address,
          privateKey: funder.privateKey,
          userLayerId,
        });

        order = hideSensitiveData(order, ["privateKey"]);
      } else if (collection.type === "IPFS") {
        if (!collection.contractAddress)
          throw new Error("Collection with no contract address not found.");

        //TODO: refactor this method for generating mint transaction tx by pickedLaunchItem.collectible.cid
        const unsignedTx =
          await launchPadService.getUnsignedLaunchMintTransaction(
            collectible,
            user.address,
            collection.contractAddress,
            db
          );
        singleMintTxHex = serializeBigInt(unsignedTx);
      }

      return { launchItem: launchItem, order, singleMintTxHex };
    });

    return {
      launchItem: launchItem,
      order: result.order,
      singleMintTxHex: result.singleMintTxHex,
    };
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
    if (isLaunchItemOnHold && isLaunchItemOnHold.onHoldBy !== user.id)
      throw new CustomError(
        "This launch item is currently reserved to another user.",
        400
      );
    if (isLaunchItemOnHold && isLaunchItemOnHold.status === "SOLD")
      throw new CustomError("Launch item has already been sold.", 400);

    const launchItem = await launchItemRepository.getById(launchItemId);
    if (!launchItem) throw new CustomError("Launch item not found.", 400);

    const launch = await launchRepository.getById(launchItem.launchId);
    if (!launch) throw new CustomError("Launch not found.", 400);
    if (launch.status === "UNCONFIRMED")
      throw new CustomError("Unconfirmed launch.", 400);

    const collection = await collectionRepository.getById(
      db,
      launch.collectionId
    );
    if (!collection) throw new CustomError("Collection not found.", 400);
    if (collection?.type === "SYNTHETIC" || collection.parentCollectionId)
      throw new CustomError("You cannot buy the item of this collection.", 400);

    const parentCollectible = await collectibleRepository.getById(
      launchItem.collectibleId
    );
    if (!parentCollectible)
      throw new CustomError("Collectible not found.", 400);
    if (!parentCollectible.fileKey)
      throw new CustomError("Collectible file key not found.", 400);

    const result = await db.transaction().execute(async (trx) => {
      if (
        collection.type === "INSCRIPTION" ||
        collection.type === "RECURSIVE_INSCRIPTION"
      ) {
        if (!verification?.orderId)
          throw new CustomError(
            "You must provide orderId for this operation.",
            400
          );

        const L2Collection =
          await collectionRepository.getChildCollectionByParentCollectionId(
            collection.id
          );
        if (
          !L2Collection ||
          !L2Collection.contractAddress ||
          !L2Collection.creatorUserLayerId
        )
          throw new CustomError("Child collection not found.", 400);

        if (collection.type === "RECURSIVE_INSCRIPTION") {
          //TODO: Validate if all traits of the collection has already been minted or not
        }

        const order = await orderRepository.getById(verification.orderId);
        if (!order) throw new CustomError("Order not found.", 400);
        if (!order.fundingAddress || !order.privateKey)
          throw new CustomError(
            "Order has invalid funding address and private key.",
            400
          );

        // const balance = await getBalance(order.fundingAddress);
        // if (balance < order.fundingAmount)
        //   throw new CustomError("Fee has not been transferred yet.", 400);

        //TODO: inscribe L1 ordinals by order.privateKey, mint L2 synthetic asset by vault
        if (!parentCollectible.fileKey)
          throw new CustomError("Collectible with no file key.", 400);
        const vault = await createFundingAddress("TESTNET");
        const file = await getObjectFromS3(parentCollectible.fileKey);
        const inscriptionData = {
          address: vault.address,
          opReturnValues: `data:${file.contentType};base64,${(
            file.content as Buffer
          ).toString("base64")}` as any,
        };
        const { commitTxHex, revealTxHex } = await inscribe(
          inscriptionData,
          order.fundingAddress,
          order.privateKey,
          true,
          order.feeRate
        );
        const commitTxResult = await sendRawTransaction(commitTxHex);
        if (!commitTxResult)
          throw new CustomError("Could not broadcast the commit tx.", 400);
        const revealTxResult = await sendRawTransaction(revealTxHex);
        if (!revealTxResult)
          throw new CustomError("Could not broadcast the reveal tx.", 400);
        const inscriptionId = revealTxResult + "i0";

        let mintTxId = "";
        try {
          // Mint the NFT with the inscription ID
          mintTxId = await nftService.mintWithInscriptionId(
            L2Collection.contractAddress,
            user.address,
            inscriptionId,
            parentCollectible.nftId
          );
          // vault.address = fundingService.getVaultAddress();

          if (!mintTxId) {
            throw new CustomError(
              "Failed to mint NFT with inscription ID",
              400
            );
          }
        } catch (error) {
          logger.error("Error during NFT minting:", error);
          throw new CustomError(`Failed to mint NFT: ${error}`, 400);
        }

        await orderRepository.update(trx, verification.orderId, {
          orderStatus: "DONE",
        });

        await collectibleRepository.create(trx, {
          name: parentCollectible.name,
          collectionId: L2Collection.id,
          uniqueIdx:
            L2Collection.contractAddress + "i" + parentCollectible.nftId,
          nftId: parentCollectible.nftId,
          mintingTxId: inscriptionId,
          parentCollectibleId: parentCollectible.id,
          fileKey: parentCollectible.fileKey,
          status: "CONFIRMED",
          highResolutionImageUrl: parentCollectible.highResolutionImageUrl,
        });

        await collectibleRepository.update(trx, parentCollectible.id, {
          lockingAddress: vault.address,
          lockingPrivateKey: vault.privateKey,
          mintingTxId: revealTxResult,
          uniqueIdx: inscriptionId,
          status: "CONFIRMED",
        });

        await collectionRepository.incrementCollectionSupplyById(
          trx,
          L2Collection.id
        );

        if (L2Collection.status === "UNCONFIRMED")
          await collectionRepository.update(trx, L2Collection.id, {
            status: "CONFIRMED",
          });
      } else if (collection.type === "IPFS") {
        if (!verification?.txid)
          throw new CustomError(
            "You must provide mint txid for this operation.",
            400
          );

        const transactionDetail =
          await confirmationService.getTransactionDetails(verification.txid);
        if (transactionDetail.status !== 1) {
          throw new CustomError(
            "Transaction not confirmed. Please try again.",
            500
          );
        }
      }

      await collectionRepository.incrementCollectionSupplyById(
        trx,
        collection.id
      );

      if (collection.status === "UNCONFIRMED")
        await collectionRepository.update(trx, collection.id, {
          status: "CONFIRMED",
        });

      const soldLaunchItem = await launchItemRepository.update(
        trx,
        launchItem.id,
        {
          status: "SOLD",
        }
      );
      await collectibleRepository.update(trx, parentCollectible.id, {
        status: "CONFIRMED",
      });

      await purchaseRepository.create(trx, {
        userId: user.id,
        launchItemId: soldLaunchItem.id,
      });
    });

    return { launchItem, collectible: parentCollectible };
  },
  createOrderForReservedLaunchItems: async (
    launchId: string,
    issuerId: string,
    userLayerId: string
  ) => {
    /* 
      CAN ONLY BE DONE BY SUPER_ADMIN(FOR NOW?)
      GET ALL RESERVED LAUNCHITEMS
      CREATE MINT ORDER & ORDERITEMS

      RETURN ORDER
    */

    const issuer = await userRepository.getByUserLayerId(userLayerId);
    if (!issuer) throw new CustomError("User not found.", 400);
    if (issuer.id !== issuerId)
      throw new CustomError(
        "You are not allowed to do this actions behalf of this user.",
        400
      );
    if (issuer.role !== "SUPER_ADMIN")
      throw new CustomError(
        "Only admins are allowed to do this opearation.",
        400
      );

    const launch = await launchRepository.getById(launchId);
    if (!launch) throw new CustomError("Launch not found.", 400);

    // const reservedLaunchItemsCount =
    //   await launchRepository.getLaunchItemCountByLaunchIdAndStatus(
    //     launch.id,
    //     "RESERVED"
    //   );
    // if (!reservedLaunchItemsCount)
    //   throw new CustomError("Could not count the reserved launch items.", 400);

    // const BATCH_SIZE = 50;
    // const BATCH_COUNT = Math.ceil(
    //   Number(reservedLaunchItemsCount) / BATCH_SIZE
    // );
    // for (let i = 0; i < BATCH_COUNT; i++) {
    //   const offset = i * BATCH_SIZE;
    // }

    const reservedLaunchItems =
      await launchItemRepository.getByLaunchIdAndStatus(launch.id, "RESERVED");
    if (reservedLaunchItems.length === 0)
      throw new CustomError("Could not get the reserved launch items.", 400);

    let funder = createFundingAddress("TESTNET");
    const order = await orderRepository.create(db, {
      userId: issuer.id,
      fundingAmount: 0,
      fundingAddress: funder.address,
      privateKey: funder.privateKey,
      orderType: "MINT_COLLECTIBLE",
      collectionId: launch.collectionId,
      feeRate: 1,
      userLayerId,
    });

    const orderItemsData: Insertable<OrderItem>[] = [];
    for (let i = 0; i < reservedLaunchItems.length; i++) {
      orderItemsData.push({
        orderId: order.id,
        type: "COLLECTIBLE",
        collectibleId: reservedLaunchItems[i].collectibleId,
      });
    }
    const orderItems = await orderItemRepository.bulkInsert(orderItemsData);
    if (orderItems.length === 0)
      throw new CustomError("Order item not created.", 400);

    return { order, launch };
  },
  invokeMintingForReservedLaunchItems: async (
    orderId: string,
    launchId: string,
    issuerId: string,
    userLayerId: string
  ) => {
    /*
      CHECK IF ORDER.ADDRESS WAS FUNDED
      SET THE ORDER & ORDERITEMS AS IN_QUEUE
      SET THE LAUNCHITEMS AS SOLD
      ENQUEUE THE ORDERID FOR MINT
    */

    const issuer = await userRepository.getByUserLayerId(userLayerId);
    if (!issuer) throw new CustomError("User not found.", 400);
    if (issuer.id !== issuerId)
      throw new CustomError(
        "You are not allowed to do this actions behalf of this user.",
        400
      );
    if (issuer.role !== "SUPER_ADMIN")
      throw new CustomError(
        "Only admins are allowed to do this opearation.",
        400
      );

    const launch = await launchRepository.getById(launchId);
    if (!launch) throw new CustomError("Launch not found.", 400);

    await orderRepository.updateOrderStatus(orderId, "IN_QUEUE");
    await orderItemRepository.updateByOrderId(orderId, { status: "IN_QUEUE" });

    await launchItemRepository.updateReservedLaunchItemStatusByLaunchId(
      launch.id,
      "SOLD"
    );

    producer.sendMessage(orderId, 5);
    logger.info(`Enqueued ${orderId} to the SQS`);

    return launch;
  },
};
