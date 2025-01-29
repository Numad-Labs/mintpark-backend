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
import {
  Collectible,
  Launch,
  LaunchItem,
  OrderItem,
  WlAddress
} from "../types/db/types";
import { EVM_CONFIG } from "../blockchain/evm/evm-config";
import { TransactionConfirmationService } from "../blockchain/evm/services/transactionConfirmationService";
import LaunchpadService from "../blockchain/evm/services/launchpadService";
import MarketplaceService from "../blockchain/evm/services/marketplaceService";
import { BADGE_BATCH_SIZE, FILE_COUNT_LIMIT } from "../libs/constants";
import { db } from "../utils/db";
import logger from "../config/winston";
import { recursiveInscriptionParams } from "../controllers/collectibleController";
import { collectibleServices } from "./collectibleServices";
import { serializeBigInt } from "../blockchain/evm/utils";
import { createFundingAddress } from "../blockchain/bitcoin/createFundingAddress";
import { purchaseRepository } from "../repositories/purchaseRepository";
import { getBalance, getEstimatedFee } from "../blockchain/bitcoin/libs";
import {
  COMMIT_TX_SIZE,
  REVEAL_TX_SIZE
} from "../blockchain/bitcoin/constants";
import NFTService from "../blockchain/evm/services/nftService";
import { inscribe } from "../blockchain/bitcoin/inscribe";
import { sendRawTransaction } from "../blockchain/bitcoin/sendTransaction";
import { hideSensitiveData } from "../libs/hideDataHelper";
import { orderItemRepository } from "../repositories/orderItemRepository";
import { producer } from "..";
import { wlRepository } from "../repositories/wlRepository";
import { FundingAddressService } from "../blockchain/evm/services/fundingAddress";
import { ethers } from "ethers";
import { DatabaseError } from "pg";

const launchPadService = new LaunchpadService(
  EVM_CONFIG.RPC_URL,
  new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS)
);

const nftService = new NFTService(EVM_CONFIG.RPC_URL);

const confirmationService = new TransactionConfirmationService(
  EVM_CONFIG.RPC_URL!
);
const fundingService = new FundingAddressService(EVM_CONFIG.RPC_URL);

export const launchServices = {
  create: async (
    userId: string,
    data: Insertable<Launch>,
    txid: string,
    totalFileSize: number | null,
    totalTraitCount: number | null,
    feeRate: number | null,
    badge: Express.Multer.File | null,
    badgeSupply: number | null
  ) => {
    const collection = await collectionRepository.getById(
      db,
      data.collectionId
    );
    if (!collection) throw new CustomError("Invalid collectionId.", 400);
    if (
      collection.type === "SYNTHETIC" ||
      // collection.type === "IPFS_FILE" ||
      collection.parentCollectionId
    )
      throw new CustomError("Invalid collection type.", 400);

    if (collection.creatorId !== userId)
      throw new CustomError("You are not the creator of this collection.", 400);

    const user = await userRepository.getByUserLayerId(data.userLayerId);
    if (!user) throw new CustomError("Invalid user layer.", 400);
    if (!user.isActive)
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
          db,
          collection.id
        );
      if (!childCollection)
        throw new CustomError(
          "Child collection must be recorded for this operation.",
          400
        );

      const layerType = await layerRepository.getById(childCollection.layerId);
      if (!layerType) throw new CustomError("Layer not found.", 400);

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
        contractAddress: transactionDetail.deployedContractAddress
      });
    } else if (
      collection.type === "IPFS_CID" ||
      collection.type === "IPFS_FILE"
    ) {
      if (collection.isBadge) {
        if (!badge) throw new CustomError("Badge file must be provided.", 400);
        if (!badgeSupply)
          throw new CustomError("Badge supply must be provided.", 400);
        if (Number(badgeSupply) < 1)
          throw new CustomError("Invalid badge supply.", 400);

        const key = randomUUID();
        await uploadToS3(key, badge);

        //DG TODO done: upload the file to IPFS & parse the CID
        // const badgeCid = await nftService.uploadImage(badge)
        // ;

        const ipfsUri = await nftService.uploadNFTMetadata(
          badge,
          collection.name || "Unnamed NFT"
        );

        await collectionRepository.update(db, collection.id, {
          logoKey: key,
          badgeSupply: badgeSupply,
          // badgeCid: badgeCid.IpfsHash,
          badgeCid: ipfsUri
        });
      }

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
        contractAddress: transactionDetail.deployedContractAddress
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
        createdAt: new Date().toISOString()
      });
    }

    const launch = await launchRepository.create(db, data);

    return { launch, order };
  },
  createInscriptionAndLaunchItemInBatch: async (
    userId: string,
    collectionId: string,
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
    const collectibles = await collectibleServices.createCollectiblesByFiles(
      { id: collection.id, name: collection.name },
      Number(existingLaunchItemCount),
      files
    );

    const launchItemsData: Insertable<LaunchItem>[] = [];
    for (let i = 0; i < collectibles.length; i++)
      launchItemsData.push({
        collectibleId: collectibles[i].id,
        launchId: launch.id
      });
    const launchItems = await launchItemRepository.bulkInsert(
      db,
      launchItemsData
    );

    if (isLastBatch) {
      if (Number(existingLaunchItemCount) + launchItems.length <= 0)
        throw new CustomError("Launch with no launch items.", 400);

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
      { id: collection.id, name: collection.name },
      Number(existingLaunchItemCount),
      data
    );

    const launchItemsData: Insertable<LaunchItem>[] = [];
    for (let i = 0; i < result.collectibles.length; i++)
      launchItemsData.push({
        collectibleId: result.collectibles[i].id,
        launchId: launch.id
      });
    const launchItems = await launchItemRepository.bulkInsert(
      db,
      launchItemsData
    );

    if (isLastBatch) {
      if (Number(existingLaunchItemCount) + launchItems.length <= 0)
        throw new CustomError("Launch with no launch items.", 400);

      //TODO: INVOKE THE RECURSIVE TRAIT MINTING, GET ORDERID BY THE LAUNCH.COLLECTIONID
      // CONFIRM THE LAUNCH AFTER MINTING THE LAST TRAIT OF THE COLLECTION
    }

    return {
      collectibles: result.collectibles,
      collectibleTraits: result.collectibleTraits,
      launchItems
    };
  },
  createIpfsFileAndLaunchItemInBatch: async (
    userId: string,
    collectionId: string,
    files: Express.Multer.File[],
    isLastBatch: boolean
  ) => {
    const collection = await collectionRepository.getById(db, collectionId);
    if (!collection) throw new CustomError("Invalid collectionId.", 400);
    if (collection?.type !== "IPFS_FILE")
      throw new CustomError("Invalid collection type.", 400);
    if (collection.creatorId !== userId)
      throw new CustomError("You are not the creator of this collection.", 400);

    const launch = await launchRepository.getByCollectionId(collectionId);
    if (!launch) throw new CustomError("Launch not found.", 400);
    if (launch.status === "CONFIRMED")
      throw new CustomError("This launch has already been confirmed.", 400);

    const existingLaunchItemCount =
      await launchRepository.getLaunchItemCountByLaunchId(db, launch.id);
    const collectibles = await collectibleServices.createCollectiblesByFiles(
      { id: collection.id, name: collection.name },
      Number(existingLaunchItemCount),
      files
    );

    const launchItemsData: Insertable<LaunchItem>[] = [];
    for (let i = 0; i < collectibles.length; i++)
      launchItemsData.push({
        collectibleId: collectibles[i].id,
        launchId: launch.id
      });
    const launchItems = await launchItemRepository.bulkInsert(
      db,
      launchItemsData
    );

    if (isLastBatch) {
      if (Number(existingLaunchItemCount) + launchItems.length <= 0)
        throw new CustomError("Launch with no launch items.", 400);

      await launchRepository.update(launch.id, { status: "CONFIRMED" });
    }

    return { collectibles, launchItems };
  },
  createIpfsCollectiblesAndLaunchItemInBatch: async (
    userId: string,
    collectionId: string,
    data: { CIDs?: string[]; file?: Express.Multer.File },
    isLastBatch: boolean
  ) => {
    const collection = await collectionRepository.getById(db, collectionId);
    console.log(collectionId);
    if (!collection) throw new CustomError("Invalid collectionId.", 400);
    if (collection.type !== "IPFS_CID" && collection.type !== "IPFS_FILE")
      throw new CustomError("Invalid collection type.", 400);
    if (collection.creatorId !== userId)
      throw new CustomError("You are not the creator of this collection.", 400);

    const launch = await launchRepository.getByCollectionId(collectionId);
    if (!launch) throw new CustomError("Launch not found.", 400);
    if (launch.status === "CONFIRMED")
      throw new CustomError("This launch has already been confirmed.", 400);

    const existingLaunchItemCount =
      await launchRepository.getLaunchItemCountByLaunchId(db, launch.id);

    let collectibles: Insertable<Collectible>[] = [],
      isDone = false;
    if (collection.isBadge) {
      if (!collection.badgeCid || !collection.badgeSupply)
        throw new CustomError("Invalid badge details.", 400);

      collectibles = await collectibleServices.createIpfsBadgeCollectibles(
        {
          id: collection.id,
          name: collection.name,
          badgeSupply: collection.badgeSupply
        },
        Number(existingLaunchItemCount),
        collection.badgeCid,
        collection.logoKey
      );

      if (
        Number(existingLaunchItemCount) + BADGE_BATCH_SIZE >=
        collection.badgeSupply
      )
        isDone = true;
    } else {
      if (!data.CIDs)
        throw new CustomError("Invalid ipfs collectible data.", 400);

      collectibles = await collectibleServices.createIpfsNftCollectibles(
        collection,
        Number(existingLaunchItemCount),
        data.CIDs
      );
    }

    const launchItemsData: Insertable<LaunchItem>[] = [];
    for (let i = 0; i < collectibles.length; i++) {
      launchItemsData.push({
        collectibleId: collectibles[i].id as string,
        launchId: launch.id
      });
    }

    const launchItems = await launchItemRepository.bulkInsert(
      db,
      launchItemsData
    );

    if (isLastBatch || isDone) {
      if (Number(existingLaunchItemCount) + launchItems.length <= 0)
        throw new CustomError("Launch with no launch items.", 400);

      await launchRepository.update(launch.id, { status: "CONFIRMED" });
    }

    return { collectibles, launchItems, isDone };
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
    if (!user.isActive)
      throw new CustomError("This account is deactivated.", 400);

    const launch = await launchRepository.getById(db, id);
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

    const result = await db.transaction().execute(async (trx) => {
      try {
        await userRepository.acquireLockByUserLayerId(trx, userLayerId);
      } catch (error) {
        if (error instanceof DatabaseError && error.code === "55P03") {
          throw new CustomError(
            "Previous request is currently being processed. Please try again in a moment.",
            409
          );
        }

        throw error;
      }

      const currentUnixTimeStamp = Math.floor(Date.now() / 1000);
      let mintPrice = launch.poMintPrice;
      if (
        launch.isWhitelisted &&
        Number(launch.wlStartsAt) < currentUnixTimeStamp &&
        Number(launch.wlEndsAt) > currentUnixTimeStamp
      ) {
        const wlAddress = await wlRepository.getByLaunchIdAndAddress(
          trx,
          launch.id,
          user.address
        );
        if (!wlAddress)
          throw new CustomError(
            "You are not allowed to participate in this phase.",
            400
          );

        mintPrice = Number(launch.wlMintPrice);

        const wlUserPurchaseCount =
          await purchaseRepository.getCountByUserIdLaunchIdAndUnixTimestamp(
            trx,
            launch.id,
            user.id,
            Number(launch.wlStartsAt)
          );

        if (
          wlUserPurchaseCount &&
          wlUserPurchaseCount >= Number(launch.wlMaxMintPerWallet)
        )
          throw new CustomError(
            "Wallet limit has been reached for whitelist phase.",
            400
          );
      } else if (
        Number(launch.poStartsAt) < currentUnixTimeStamp &&
        (!launch.poEndsAt || Number(launch.poEndsAt) > currentUnixTimeStamp)
      ) {
        //PO ACTIVE
        const poUserPurchaseCount =
          await purchaseRepository.getCountByUserIdLaunchIdAndUnixTimestamp(
            trx,
            launch.id,
            user.id,
            Number(launch.poStartsAt)
          );

        if (
          poUserPurchaseCount &&
          poUserPurchaseCount >= Number(launch.poMaxMintPerWallet)
        )
          throw new CustomError(
            "Wallet limit has been reached for public offering phase.",
            400
          );
      } else if (Number(launch.poStartsAt) > currentUnixTimeStamp) {
        throw new CustomError("Launch hasn't started.", 400);
      } else if (
        launch.poEndsAt &&
        Number(launch.poEndsAt) < currentUnixTimeStamp
      ) {
        throw new CustomError("Launch has ended.", 400);
      }

      const userOnHoldItemCount =
        await launchItemRepository.getOnHoldCountByLaunchIdAndUserId(
          trx,
          launch.id,
          user.id
        );
      if (Number(userOnHoldItemCount) >= 3)
        throw new CustomError("You have too many items reserved.", 400);

      const launchItem = await launchItemRepository.getRandomItemByLaunchId(
        launch.id
      );

      const pickedLaunchItem = await launchItemRepository.setOnHoldById(
        trx,
        launchItem.id,
        user.id
      );
      const collectible = await collectibleRepository.getById(
        trx,
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
          userLayerId
        });

        order = hideSensitiveData(order, ["privateKey"]);
      } else if (
        collection.type === "IPFS_CID" ||
        collection.type === "IPFS_FILE"
      ) {
        if (!collection.contractAddress)
          throw new Error("Collection with no contract address not found.");
        if (collection.type === "IPFS_CID" && !collectible.cid)
          throw new CustomError("Collectible with no cid.", 400);

        // if (!collectible.chainId)
        //   throw new CustomError("Collectible with no chainId.", 400);
        // const chainConfig = EVM_CONFIG.CHAINS[collectible.chainId];

        // First estimate the gas fee for vault minting
        const dummyUri = collectible.cid || "ipfs://dummy"; // Use existing CID if available
        const gasFeeEstimate = await nftService.estimateMintGasFee(
          collection.contractAddress,
          user.address,
          collectible.nftId,
          dummyUri,
          mintPrice
        );

        // Calculate total required amount (mint price + gas fee)
        const mintPriceWei = ethers.parseEther(mintPrice.toString());
        const totalRequired = mintPriceWei + gasFeeEstimate.estimatedGasCost;
        const formattedTotal = ethers.formatEther(totalRequired);

        if (collection.type === "IPFS_FILE" && !collectible.cid) {
          if (!collectible.fileKey)
            throw new CustomError("Collectible has no file key.", 400);

          //fetch file from S3 & upload file to ipfs & update the collectible to set the cid
          const cid = await nftService.uploadS3FileToIpfs(
            collectible.fileKey,
            collectible.name
          );

          await collectibleRepository.update(trx, collectible.id, { cid });
        }

        //DG TODO: generate txHex to transfer gasFee + serviceFee + mintFee... to vault
        const unsignedTx = await fundingService.getUnsignedFeeTransaction(
          user.address,
          formattedTotal.toString()
        );

        if (!unsignedTx)
          throw new CustomError("No unsigned transaction built", 400);
        if (!unsignedTx.value)
          throw new CustomError("Transaction value not found", 400);
        //DG todo : private key save hiih eseh
        order = await orderRepository.create(trx, {
          userId: user.id,
          collectionId: launch.collectionId,
          feeRate,
          orderType: "LAUNCH_BUY",
          fundingAmount: parseInt(unsignedTx.value.toString()),
          fundingAddress: unsignedTx.to?.toString(),
          privateKey: "evm",
          userLayerId
        });
        order = hideSensitiveData(order, ["privateKey"]);

        singleMintTxHex = serializeBigInt(unsignedTx);
      } else throw new CustomError("Unsupported collection type.", 400);

      return { launchItem: launchItem, order, singleMintTxHex };
    });

    return {
      launchItem: result.launchItem,
      order: result.order,
      singleMintTxHex: result.singleMintTxHex
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
    if (!user.isActive)
      throw new CustomError("This account is deactivated.", 400);

    const result = await db.transaction().execute(async (trx) => {
      try {
        await userRepository.acquireLockByUserLayerId(trx, userLayerId);
      } catch (error) {
        if (error instanceof DatabaseError && error.code === "55P03") {
          throw new CustomError(
            "Previous request is currently being processed. Please try again in a moment.",
            409
          );
        }

        throw error;
      }

      const isLaunchItemOnHold = await launchItemRepository.getOnHoldById(
        trx,
        launchItemId
      );
      if (isLaunchItemOnHold && isLaunchItemOnHold.onHoldBy !== user.id)
        throw new CustomError(
          "This launch item is currently reserved to another user.",
          400
        );
      if (isLaunchItemOnHold && isLaunchItemOnHold.status === "SOLD")
        throw new CustomError("Launch item has already been sold.", 400);

      const launchItem = await launchItemRepository.getById(trx, launchItemId);
      if (!launchItem) throw new CustomError("Launch item not found.", 400);

      const launch = await launchRepository.getById(trx, launchItem.launchId);
      if (!launch) throw new CustomError("Launch not found.", 400);
      if (launch.status === "UNCONFIRMED")
        throw new CustomError("Unconfirmed launch.", 400);

      const collection = await collectionRepository.getById(
        db,
        launch.collectionId
      );
      if (!collection) throw new CustomError("Collection not found.", 400);
      if (collection?.type === "SYNTHETIC" || collection.parentCollectionId)
        throw new CustomError(
          "You cannot buy the item of this collection.",
          400
        );

      const parentCollectible = await collectibleRepository.getById(
        trx,
        launchItem.collectibleId
      );
      if (!parentCollectible)
        throw new CustomError("Collectible not found.", 400);
      if (!parentCollectible.fileKey)
        throw new CustomError("Collectible file key not found.", 400);

      let mintPrice;
      if (launch.isWhitelisted) {
        mintPrice = launch.wlMintPrice;
      } else {
        mintPrice = launch.poMintPrice;
      }
      // if (!mintPrice)
      //   throw new CustomError("Mint price not found try again", 400);

      let nftIpfsUrl;

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
            trx,
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

        const order = await orderRepository.getById(trx, verification.orderId);
        if (!order) throw new CustomError("Order not found.", 400);
        if (!order.fundingAddress || !order.privateKey)
          throw new CustomError(
            "Order has invalid funding address and private key.",
            400
          );

        // const balance = await getBalance(order.fundingAddress);
        // if (balance < order.fundingAmount)
        //   throw new CustomError("Fee has not been transferred yet.", 400);

        if (!parentCollectible.fileKey)
          throw new CustomError("Collectible with no file key.", 400);
        const vault = await createFundingAddress("TESTNET");
        const file = await getObjectFromS3(parentCollectible.fileKey);
        const inscriptionData = {
          address: vault.address,
          opReturnValues: `data:${file.contentType};base64,${(
            file.content as Buffer
          ).toString("base64")}` as any
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
            parentCollectible.nftId,
            Number(mintPrice)
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
          orderStatus: "DONE"
        });

        await collectibleRepository.create(trx, {
          name: parentCollectible.name,
          collectionId: L2Collection.id,
          uniqueIdx:
            L2Collection.contractAddress + "i" + parentCollectible.nftId,
          nftId: parentCollectible.nftId,
          mintingTxId: mintTxId,
          parentCollectibleId: parentCollectible.id,
          fileKey: parentCollectible.fileKey,
          status: "CONFIRMED",
          highResolutionImageUrl: parentCollectible.highResolutionImageUrl
        });

        await collectibleRepository.update(trx, parentCollectible.id, {
          lockingAddress: vault.address,
          lockingPrivateKey: vault.privateKey,
          mintingTxId: revealTxResult,
          uniqueIdx: inscriptionId,
          status: "CONFIRMED"
        });

        await collectionRepository.incrementCollectionSupplyById(
          trx,
          L2Collection.id
        );

        if (L2Collection.status === "UNCONFIRMED")
          await collectionRepository.update(trx, L2Collection.id, {
            status: "CONFIRMED"
          });
      } else if (
        collection.type === "IPFS_CID" ||
        collection.type === "IPFS_FILE"
      ) {
        if (!verification?.txid || !verification?.orderId)
          throw new CustomError(
            "You must provide mint txid and orderId for this operation.",
            400
          );
        if (!collection.contractAddress)
          throw new CustomError("Contract address must be provided", 400);

        const transactionDetail =
          await confirmationService.getTransactionDetails(verification.txid);

        if (transactionDetail.status !== 1) {
          throw new CustomError(
            "Transaction not confirmed. Please try again.",
            500
          );
        }

        if (collection.type === "IPFS_FILE" && !parentCollectible.cid)
          throw new CustomError("File has not been uploaded to the ipfs.", 400);

        //DG TODO NEW: transaction detail deeres mintprice, vault address validate hiideg bh
        if (!parentCollectible.fileKey)
          throw new CustomError("File key must be provided", 400);

        if (parentCollectible.cid) {
          nftIpfsUrl = parentCollectible.cid;
        } else {
          nftIpfsUrl = await nftService.uploadS3FileToIpfs(
            parentCollectible.fileKey,
            parentCollectible.name || "Unnamed NFT"
          );
        }

        await nftService.mintIpfsNFTUsingVault(
          collection.contractAddress,
          user.address,
          parentCollectible.nftId,
          //DG TODO: "uri ? eniig ashiglah zov eseh",
          nftIpfsUrl,
          Number(mintPrice)
        );
        await collectibleRepository.update(trx, parentCollectible.id, {
          status: "CONFIRMED",
          mintingTxId: verification.txid,
          cid: nftIpfsUrl,
          uniqueIdx: collection.contractAddress + "i" + parentCollectible.nftId
        });

        await orderRepository.update(trx, verification.orderId, {
          orderStatus: "DONE"
        });
      } else throw new CustomError("Unsupported collection type.", 400);

      await collectionRepository.incrementCollectionSupplyById(
        trx,
        collection.id
      );

      if (collection.status === "UNCONFIRMED")
        await collectionRepository.update(trx, collection.id, {
          status: "CONFIRMED"
        });

      const soldLaunchItem = await launchItemRepository.update(
        trx,
        launchItem.id,
        {
          status: "SOLD"
        }
      );

      await purchaseRepository.create(trx, {
        userId: user.id,
        launchItemId: soldLaunchItem.id
      });

      return { launchItem, parentCollectible };
    });

    return {
      launchItem: result.launchItem,
      collectible: result.parentCollectible
    };
  },
  createOrderForReservedLaunchItems: async (
    launchId: string,
    issuerId: string,
    userLayerId: string
  ) => {
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
    if (!issuer.isActive)
      throw new CustomError("This account is deactivated.", 400);

    const launch = await launchRepository.getById(db, launchId);
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
      userLayerId
    });

    const orderItemsData: Insertable<OrderItem>[] = [];
    for (let i = 0; i < reservedLaunchItems.length; i++) {
      orderItemsData.push({
        orderId: order.id,
        type: "COLLECTIBLE",
        collectibleId: reservedLaunchItems[i].collectibleId
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
    if (!issuer.isActive)
      throw new CustomError("This account is deactivated.", 400);

    const launch = await launchRepository.getById(db, launchId);
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
  addWhitelistAddress: async (
    issuerId: string,
    launchId: string,
    addresses: string[]
  ) => {
    const launch = await launchRepository.getById(db, launchId);
    if (!launch) throw new CustomError("Launch not found.", 400);
    if (!launch.isWhitelisted)
      throw new CustomError("Launch is not whitelisted.", 400);

    const collection = await collectionRepository.getById(
      db,
      launch.collectionId
    );
    if (!collection) throw new CustomError("Collection not found.", 400);
    if (collection.creatorId !== issuerId)
      throw new CustomError("You are not the creator of this launch.", 400);

    if (addresses.length > 50)
      throw new CustomError("Address count cannot be more than 100.", 400);

    const whitelistAddresses: Insertable<WlAddress>[] = [];
    addresses.forEach((address) =>
      whitelistAddresses.push({
        launchId: launch.id,
        address: address.toLowerCase()
      })
    );

    const wlAddress = await wlRepository.bulkInsert(whitelistAddresses);

    return wlAddress;
  }
};
