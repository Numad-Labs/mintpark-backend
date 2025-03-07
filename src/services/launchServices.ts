import { randomUUID } from "crypto";
import { launchRepository } from "../repositories/launchRepository";
import { uploadToS3 } from "../utils/aws";
import { launchItemRepository } from "../repositories/launchItemRepository";
import { collectionRepository } from "../repositories/collectionRepository";
import { userRepository } from "../repositories/userRepository";
import { orderRepository } from "../repositories/orderRepostory";
import { layerRepository } from "../repositories/layerRepository";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { CustomError } from "../exceptions/CustomError";
import { Insertable } from "kysely";
import {
  Collectible,
  Launch,
  LaunchItem,
  OrderItem,
  WlAddress
} from "../types/db/types";
import { EVM_CONFIG } from "../blockchain/evm/evm-config";
import { TransactionConfirmationService } from "../blockchain/evm/services/transactionConfirmationService";
import { BADGE_BATCH_SIZE } from "../libs/constants";
import { db } from "../utils/db";
import logger from "../config/winston";
import { recursiveInscriptionParams } from "../controllers/collectibleController";
import { collectibleServices } from "./collectibleServices";
import { serializeBigInt } from "../blockchain/evm/utils";
import { createFundingAddress } from "../blockchain/bitcoin/createFundingAddress";
import { purchaseRepository } from "../repositories/purchaseRepository";
import { hideSensitiveData } from "../libs/hideDataHelper";
import { orderItemRepository } from "../repositories/orderItemRepository";
import { wlRepository } from "../repositories/wlRepository";
import { SQSClientFactory } from "../queue/sqsClient";
import { DirectMintNFTService } from "../blockchain/evm/services/nftService/directNFTService";
import { BaseNFTService } from "../blockchain/evm/services/nftService/baseNFTService";
import { LAUNCH_PHASE } from "types/db/enums";

export const launchServices = {
  create: async (
    userId: string,
    data: Insertable<Launch>,
    txid: string,
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
      collection.parentCollectionId ||
      collection.type === "INSCRIPTION" ||
      collection.type === "RECURSIVE_INSCRIPTION"
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

    const layer = await layerRepository.getById(collection.layerId);
    if (!layer || !layer.chainId) throw new CustomError("Invalid layer", 400);

    if (collection.isBadge) {
      if (!badge) throw new CustomError("Badge file must be provided.", 400);
      if (!badgeSupply)
        throw new CustomError("Badge supply must be provided.", 400);
      if (Number(badgeSupply) < 1)
        throw new CustomError("Invalid badge supply.", 400);

      const key = randomUUID();
      await uploadToS3(key, badge);

      const chainConfig = EVM_CONFIG.CHAINS[layer.chainId];
      const nftService = new DirectMintNFTService(chainConfig.RPC_URL);

      const ipfsUri = await nftService.uploadNFTMetadata(
        badge,
        collection.name || "Unnamed NFT"
      );

      await collectionRepository.update(db, collection.id, {
        logoKey: key,
        badgeSupply: badgeSupply,
        badgeCid: ipfsUri
      });
    }

    if (!layer.chainId) throw new CustomError("Chaind id not found.", 400);
    const chainConfig = EVM_CONFIG.CHAINS[layer.chainId];

    const confirmationService = new TransactionConfirmationService(
      chainConfig.RPC_URL
    );
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

    const launch = await launchRepository.create(db, data);

    return { launch };
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
      await collectionRepository.update(db, launch.collectionId, {
        badgeCurrentNftId:
          Number(existingLaunchItemCount) + Number(launchItems.length)
      });
    }

    return { collectibles, launchItems, isDone };
  },
  buy: async (
    userId: string,
    userLayerId: string,
    id: string,
    feeRate?: number
  ) => {
    // // --- Pre-transaction Data Fetching & Validation ---
    // const [user, launch, collection] = await Promise.all([
    //   userRepository.getByUserLayerId(userLayerId),
    //   launchRepository.getById(db, id),
    //   launchRepository
    //     .getById(db, id)
    //     .then((l) =>
    //       l ? collectionRepository.getById(db, l.collectionId) : null
    //     )
    // ]);

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
      launch?.collectionId
    );

    if (!collection) throw new CustomError("Collection not found.", 400);
    if (user.layerId !== collection?.layerId)
      throw new CustomError(
        "Please connect to the appropriate L2 for this launch.",
        400
      );
    if (collection.type === "SYNTHETIC" || collection.parentCollectionId)
      throw new CustomError("You cannot buy the item of this collection.", 400);
    if (
      collection.type === "INSCRIPTION" ||
      collection.type === "RECURSIVE_INSCRIPTION"
    )
      throw new CustomError(
        "Wrapped NFTs are not supported at the moment.",
        400
      );
    if (!collection.contractAddress)
      throw new CustomError("No contract address.", 400);
    if (collection.isBadge && !collection.badgeCid)
      throw new CustomError("No badge cid.", 400);

    const currentUnixTimeStamp = Math.floor(Date.now() / 1000);
    const mintPrice = await validatePhaseAndGetPrice(
      launch,
      user,
      currentUnixTimeStamp
    );
    await validatePurchaseLimits(db, launch, user, currentUnixTimeStamp);

    const shortHoldCount =
      await launchItemRepository.getShortHoldCountByLaunchIdAndUserId(
        db,
        launch.id,
        user.id
      );
    if (Number(shortHoldCount) >= 3)
      throw new CustomError(
        "You have too many items in short-term reservation.",
        400
      );

    if (!user.chainId) throw new CustomError("User chain id not found.", 400);
    const chainConfig = EVM_CONFIG.CHAINS[user.chainId];
    const nftService = new DirectMintNFTService(chainConfig.RPC_URL);
    const directMintService = new DirectMintNFTService(chainConfig.RPC_URL);

    const phaseInfo = await directMintService.getActivePhase(
      collection.contractAddress
    );
    if (!phaseInfo.isActive) throw new CustomError("Phase not found", 400);
    // console.log("🚀 ~ phaseInfo:", phaseInfo);

    // console.log("date", new Date(parseInt(phaseInfo.endTime)));
    if (phaseInfo.phaseType == BigInt(0))
      throw new CustomError("Phase not active", 400);

    const mintedInPhase = await directMintService.getMintedInPhase(
      collection.contractAddress,
      user.address,
      Number(phaseInfo.phaseType)
    );

    if (
      phaseInfo.maxPerWallet !== BigInt(0) &&
      mintedInPhase >= phaseInfo.maxPerWallet
    ) {
      throw new CustomError("Wallet limit reached for this phase", 400);
    }

    if (
      phaseInfo.maxSupply !== BigInt(0) &&
      phaseInfo.mintedInPhase >= phaseInfo.maxSupply
    ) {
      throw new CustomError("Phase supply limit reached", 400);
    }

    // --- Acquire a Launch Item Atomically ---
    const isInfiniteBadge = collection.isBadge && !collection.badgeSupply;
    let launchItem = await launchItemRepository.getRandomItemByLaunchId(
      launch.id
    );
    let collectible: any;

    if (isInfiniteBadge) {
      // Attempt to set the available item on hold if found.
      if (launchItem) {
        launchItem = await launchItemRepository.setShortHoldById(
          db,
          launchItem.id,
          user.id
        );
      }
      // If no launch item exists OR setting the hold fails, create a new one.
      if (!launchItem) {
        // Step 1: Get the next badgeCurrentNftId in a separate, quick transaction
        const { badgeCurrentNftId } = await db
          .transaction()
          .execute(async (trx) => {
            return await collectionRepository.incrementBadgeCurrentNftIdById(
              trx,
              collection.id
            );
          });
        if (!badgeCurrentNftId) {
          throw new CustomError("Badge current nft id not found.", 400);
        }
        const nftId = badgeCurrentNftId.toString();

        // Step 2: Create the collectible and launch item in a separate transaction
        const creationResult = await db.transaction().execute(async (trx) => {
          const newCollectible = await collectibleRepository.create(trx, {
            name: `${collection.name} #${nftId}`,
            collectionId: collection.id,
            nftId,
            cid: collection.badgeCid,
            fileKey: collection.logoKey
          });
          const newLaunchItem =
            await launchItemRepository.createOnHoldLaunchItem(
              trx,
              { launchId: launch.id, collectibleId: newCollectible.id },
              user.id
            );
          return { launchItem: newLaunchItem, collectible: newCollectible };
        });

        launchItem = creationResult.launchItem;
        collectible = creationResult.collectible;
      }
    } else {
      // Finite supply collection
      if (!launchItem)
        throw new CustomError("No available launch item was found.", 400);
      launchItem = await launchItemRepository.setShortHoldById(
        db,
        launchItem.id,
        user.id
      );
    }
    if (!launchItem) throw new CustomError("Please try again.", 400);

    logger.info(
      `launchItem id: ${launchItem.id}, onHoldUntil: ${launchItem.onHoldUntil}, onHoldBy: ${launchItem.onHoldBy}, status: ${launchItem.status}, userId: ${user.id}`
    );

    collectible = await collectibleRepository.getById(
      db,
      launchItem.collectibleId
    );
    if (!collectible)
      throw new CustomError("Please try again, no collectible found.", 400);

    // --- Check if the collectible is already minted ---
    const baseNFTService = new BaseNFTService(chainConfig.RPC_URL);
    const isMinted = await baseNFTService.isNFTMinted(
      collection.contractAddress,
      collectible.nftId
    );

    if (isMinted) {
      // Sync DB state in a transaction.
      await db.transaction().execute(async (trx) => {
        const mintedCollectible = await collectibleRepository.getById(
          trx,
          launchItem!.collectibleId
        );
        if (!mintedCollectible)
          throw new CustomError("Minted collectible not found.", 400);

        logger.info(
          `Incremented collection supply in buy method. userId: ${user.id}, launchItem id: ${launchItem?.id}, launchItem status: ${launchItem?.status}, collectible status: ${mintedCollectible.status}`
        );

        await collectibleRepository.update(trx, mintedCollectible.id, {
          status: "CONFIRMED",
          uniqueIdx: collection.contractAddress + "i" + mintedCollectible.nftId
        });
        // await collectionRepository.incrementCollectionSupplyById(
        //   trx,
        //   collection.id
        // );
        await launchItemRepository.update(trx, launchItem!.id, {
          status: "SOLD"
        });
      });

      if (isInfiniteBadge) {
        // For infinite supply badges, after syncing, create a new launch item.
        // Step 1: Get the next badgeCurrentNftId in a separate, quick transaction
        const { badgeCurrentNftId } = await db
          .transaction()
          .execute(async (trx) => {
            return await collectionRepository.incrementBadgeCurrentNftIdById(
              trx,
              collection.id
            );
          });
        if (!badgeCurrentNftId) {
          throw new CustomError("Badge current nft id not found.", 400);
        }
        const nftId = badgeCurrentNftId.toString();

        const creationResult = await db.transaction().execute(async (trx) => {
          const newCollectible = await collectibleRepository.create(trx, {
            name: `${collection.name} #${nftId}`,
            collectionId: collection.id,
            nftId,
            cid: collection.badgeCid,
            fileKey: collection.logoKey
          });
          const newLaunchItem =
            await launchItemRepository.createOnHoldLaunchItem(
              trx,
              { launchId: launch.id, collectibleId: newCollectible.id },
              user.id
            );
          return { launchItem: newLaunchItem, collectible: newCollectible };
        });
        launchItem = creationResult.launchItem;
        collectible = creationResult.collectible;
      } else {
        // For finite supply collections, synchronize then throw an error.
        throw new CustomError("The launch item has already been minted.", 400);
      }
    }

    logger.info(
      `final launchItem id: ${launchItem.id}, onHoldUntil: ${launchItem.onHoldUntil}, onHoldBy: ${launchItem.onHoldBy}, status: ${launchItem.status}, userId: ${user.id}`
    );

    // --- IPFS Upload & Mint Transaction Preparation ---
    let ipfsCid: string | undefined;
    if (
      !isInfiniteBadge &&
      collection.type === "IPFS_FILE" &&
      !collectible.cid
    ) {
      if (!collectible.fileKey)
        throw new CustomError("Collectible has no file key.", 400);
      ipfsCid = await nftService.uploadS3FileToIpfs(
        collectible.fileKey,
        collectible.name || "Unnamed NFT"
      );
    }
    const nftIpfsUrl = collection.isBadge
      ? collection.badgeCid
      : ipfsCid || collectible.cid;
    if (!nftIpfsUrl)
      throw new CustomError("File has not been uploaded to the ipfs.", 400);

    const tokenId = collectible.nftId;
    if (!isInfiniteBadge && collection.type === "IPFS_FILE" && ipfsCid) {
      await collectibleRepository.update(db, collectible.id, {
        cid: ipfsCid
      });
      collectible.cid = ipfsCid;
    }

    if (!collection.contractAddress)
      throw new CustomError("Collection contract address not found.", 400);

    // Generate signature for direct minting
    const { signature, uniqueId, timestamp } =
      await directMintService.generateMintSignature(
        collection.contractAddress,
        user.address,
        tokenId,
        nftIpfsUrl,
        mintPrice.toString(),
        Number(phaseInfo.phaseIndex)
      );

    const unsignedTx = await directMintService.getUnsignedMintTransaction(
      collection.contractAddress,
      tokenId,
      nftIpfsUrl,
      mintPrice.toString(),
      uniqueId,
      timestamp,
      signature,
      user.address
    );

    const order = await orderRepository.create(db, {
      userId: user.id,
      collectionId: collection.id,
      feeRate,
      orderType: "LAUNCH_BUY",
      fundingAmount: unsignedTx.value
        ? parseInt(unsignedTx.value.toString())
        : 0,
      fundingAddress: unsignedTx.to?.toString(),
      privateKey: "evm",
      userLayerId
    });

    return {
      launchItem: hideSensitiveData(launchItem, ["collectibleId"]),
      order: hideSensitiveData(order, ["privateKey"]),
      singleMintTxHex: serializeBigInt(unsignedTx)
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
    // // Initial validations and data fetching in parallel
    // const [user, launchItem, launch, collection] = await Promise.all([
    //   userRepository.getByUserLayerId(userLayerId),
    //   launchItemRepository.getById(db, launchItemId),
    //   launchItemRepository
    //     .getById(db, launchItemId)
    //     .then((item) =>
    //       item ? launchRepository.getById(db, item.launchId) : null
    //     ),
    //   launchItemRepository
    //     .getById(db, launchItemId)
    //     .then((item) =>
    //       item
    //         ? launchRepository
    //             .getById(db, item.launchId)
    //             .then((l) =>
    //               l ? collectionRepository.getById(db, l.collectionId) : null
    //             )
    //         : null
    //     )
    // ]);

    const user = await userRepository.getByUserLayerId(userLayerId);
    if (!user) throw new CustomError("User not found.", 400);
    if (user.id !== userId)
      throw new CustomError(
        "You are not allowed to buy from this account.",
        400
      );
    if (!user.isActive)
      throw new CustomError("This account is deactivated.", 400);

    const launchItem = await launchItemRepository.getById(db, launchItemId);
    if (!launchItem) throw new CustomError("Launch item not found.", 400);
    if (launchItem.status === "SOLD")
      throw new CustomError(
        "This launch item has already been confirmed.",
        400
      );

    const launch = await launchRepository.getById(db, launchItem.launchId);
    if (!launch) throw new CustomError("Launch not found.", 400);
    if (launch.status === "UNCONFIRMED")
      throw new CustomError("Unconfirmed launch.", 400);

    const collection = await collectionRepository.getById(
      db,
      launch.collectionId
    );
    if (!collection) throw new CustomError("Collection not found.", 400);
    if (user.layerId !== collection?.layerId)
      throw new CustomError(
        "Please connect to the appropriate L2 for this launch.",
        400
      );
    if (collection?.type === "SYNTHETIC" || collection.parentCollectionId)
      throw new CustomError("You cannot buy the item of this collection.", 400);
    if (
      collection.type === "INSCRIPTION" ||
      collection.type === "RECURSIVE_INSCRIPTION"
    )
      throw new CustomError(
        "Wrapped NFTs are not supported at the moment.",
        400
      );
    if (collection.isBadge && !collection.badgeCid)
      throw new CustomError("No badge cid.", 400);

    // // Get mint price and validate phase
    // const currentUnixTimeStamp = Math.floor(Date.now() / 1000);
    // await validatePhaseAndGetPrice(launch, user, currentUnixTimeStamp);

    // Validate launch item status
    const isLaunchItemOnHold = await launchItemRepository.getOnHoldById(
      db,
      launchItemId
    );
    if (!isLaunchItemOnHold)
      throw new CustomError("Launch item hasn't been set on hold.", 400);
    if (isLaunchItemOnHold.onHoldBy !== user.id)
      throw new CustomError(
        "This launch item is currently reserved to another user.",
        400
      );

    // // Validate purchase limits inside transaction
    // await validatePurchaseLimits(db, launch, user, currentUnixTimeStamp);

    const collectible = await collectibleRepository.getById(
      db,
      launchItem.collectibleId
    );
    if (!collectible) throw new CustomError("Collectible not found.", 400);
    if (collectible.status === "CONFIRMED")
      throw new CustomError(
        "This collectible has already been confirmed.",
        400
      );

    if (!verification)
      throw new CustomError("You must provide verification.", 400);
    const { txid, orderId } = verification;
    if (!txid || !orderId)
      throw new CustomError(
        "You must provide mint txid and orderId for this operation.",
        400
      );
    if (!collection.contractAddress)
      throw new CustomError("Contract address must be provided", 400);

    const layer = await layerRepository.getById(collection.layerId);
    if (!layer || !layer.chainId) throw new CustomError("Layer not found", 400);

    const chainConfig = EVM_CONFIG.CHAINS[layer.chainId];
    const confirmationService = new TransactionConfirmationService(
      chainConfig.RPC_URL
    );

    const transactionDetail = await confirmationService.getTransactionDetails(
      txid
    );
    if (transactionDetail.status !== 1)
      throw new CustomError(
        "Transaction not confirmed. Please try again.",
        500
      );

    // Execute database operations in transaction
    const result = await db.transaction().execute(async (trx) => {
      logger.info(
        `Incremented collection supply in confirmMint method. userId: ${user.id}, launchItem id: ${launchItem.id}, launchItem status: ${launchItem?.status}, collectible status: ${collectible.status}`
      );

      // try {
      //   await userRepository.acquireLockByUserLayerId(trx, userLayerId);
      // } catch (error) {
      //   if (error instanceof DatabaseError && error.code === "55P03") {
      //     throw new CustomError(
      //       "Previous request is currently being processed. Please try again in a moment.",
      //       409
      //     );
      //   }
      //   throw error;
      // }

      await collectibleRepository.update(trx, collectible.id, {
        status: "CONFIRMED",
        mintingTxId: txid,
        uniqueIdx: collection.contractAddress + "i" + collectible.nftId
      });
      // await collectionRepository.incrementCollectionSupplyById(
      //   trx,
      //   collection.id
      // );
      const soldLaunchItem = await launchItemRepository.update(
        trx,
        launchItem.id,
        {
          status: "SOLD"
        }
      );
      await purchaseRepository.create(trx, {
        userId: user.id,
        launchItemId: soldLaunchItem.id,
        purchasedAddress: user.address
      });
      await orderRepository.update(trx, orderId, {
        orderStatus: "DONE"
      });
      if (collection.status === "UNCONFIRMED") {
        await collectionRepository.update(trx, collection.id, {
          status: "CONFIRMED"
        });
      }

      return {
        launchItem: soldLaunchItem
      };
    });

    return {
      launchItem: result.launchItem
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

    // producer.sendMessage(orderId, 5);
    logger.info(`Enqueued ${orderId} to the SQS`);

    return launch;
  },
  addWhitelistAddress: async (
    issuerId: string,
    launchId: string,
    addresses: string[],
    phase: LAUNCH_PHASE
  ) => {
    const launch = await launchRepository.getById(db, launchId);
    if (!launch) throw new CustomError("Launch not found.", 400);
    if (!launch.isWhitelisted && phase === "WHITELIST")
      throw new CustomError("Launch is not whitelisted.", 400);
    if (!launch.hasFCFS && phase === "FCFS_WHITELIST")
      throw new CustomError("Launch does not have FCFS phase.", 400);

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
        address: address.toLowerCase(),
        phase
      })
    );

    const wlAddress = await wlRepository.bulkInsert(whitelistAddresses);

    return wlAddress;
  }
};

// Helper functions
const validatePhaseAndGetPrice = async (
  launch: any,
  user: any,
  currentTime: number
) => {
  if (
    launch.isWhitelisted &&
    Number(launch.wlStartsAt) < currentTime &&
    Number(launch.wlEndsAt) > currentTime
  ) {
    const wlAddress = await wlRepository.getByLaunchIdAndAddressAndPhase(
      db,
      launch.id,
      user.address,
      "WHITELIST"
    );
    if (!wlAddress)
      throw new CustomError(
        "You are not allowed to participate in this phase.",
        400
      );
    return Number(launch.wlMintPrice);
  }

  if (
    launch.hasFCFS &&
    Number(launch.fcfsStartsAt) < currentTime &&
    Number(launch.fcfsEndsAt) > currentTime
  ) {
    const wlAddress = await wlRepository.getByLaunchIdAndAddressAndPhase(
      db,
      launch.id,
      user.address,
      "FCFS_WHITELIST"
    );
    if (!wlAddress)
      throw new CustomError(
        "You are not allowed to participate in this phase.",
        400
      );
    return Number(launch.fcfsMintPrice);
  }

  if (Number(launch.poStartsAt) > currentTime) {
    throw new CustomError("Launch hasn't started.", 400);
  }
  if (launch.poEndsAt && Number(launch.poEndsAt) < currentTime) {
    throw new CustomError("Launch has ended.", 400);
  }

  return Number(launch.poMintPrice);
};

const validatePurchaseLimits = async (
  trx: any,
  launch: any,
  user: any,
  currentTime: number
) => {
  if (
    launch.isWhitelisted &&
    Number(launch.wlStartsAt) < currentTime &&
    Number(launch.wlEndsAt) > currentTime
  ) {
    const wlUserPurchaseCount =
      await purchaseRepository.getCountByLaunchIdUnixTimestampAndUserIdOrAddress(
        trx,
        launch.id,
        user.id,
        Number(launch.wlStartsAt),
        user.address
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
    launch.hasFCFS &&
    Number(launch.fcfsStartsAt) < currentTime &&
    Number(launch.fcfsEndsAt) > currentTime
  ) {
    const fcfsUserPurchaseCount =
      await purchaseRepository.getCountByLaunchIdUnixTimestampAndUserIdOrAddress(
        trx,
        launch.id,
        user.id,
        Number(launch.fcfsStartsAt),
        user.address
      );

    if (
      fcfsUserPurchaseCount &&
      fcfsUserPurchaseCount >= Number(launch.fcfsMaxMintPerWallet)
    )
      throw new CustomError(
        "Wallet limit has been reached for FCFS phase.",
        400
      );
  } else {
    const poUserPurchaseCount =
      await purchaseRepository.getCountByLaunchIdUnixTimestampAndUserIdOrAddress(
        trx,
        launch.id,
        user.id,
        Number(launch.poStartsAt),
        user.address
      );

    if (
      poUserPurchaseCount &&
      poUserPurchaseCount >= Number(launch.poMaxMintPerWallet)
    )
      throw new CustomError(
        "Wallet limit has been reached for public offering phase.",
        400
      );
  }
};

/* const prepareInscriptionData = async (collection: any, feeRate?: number) => {
  if (!feeRate)
    throw new CustomError("You must provide fee rate for this operation.", 400);

  let networkFee = 546;
  const funder = await createFundingAddress("TESTNET");
  const serviceFee = 0;
  const totalAmount = networkFee * 1.5 + serviceFee;

  return { funder, networkFee, totalAmount, feeRate };
};

const prepareIpfsData = async (
  collection: any,
  userAddress: string,
  chainId: string,
  mintPrice: number,
  directMintService: DirectMintNFTService
  // fundingService: FundingAddressService
) => {
  if (!collection.contractAddress)
    throw new CustomError(
      "Collection with no contract address not found.",
      400
    );

  const tokenId = collection.nextTokenId || 0; // Get next token ID
  const uri = collection.isBadge ? collection.badgeCid : ""; // Use badge CID if badge collection

  const deadline = EVM_CONFIG.DEFAULT_SIGN_DEADLINE;
  // Generate signature for direct minting
  const signature = await directMintService.generateMintSignature(
    collection.contractAddress,
    config.VAULT_ADDRESS,
    tokenId,
    uri,
    mintPrice.toString(),
    deadline,
    chainId,
    config.VAULT_PRIVATE_KEY
  );

  // Get unsigned mint transaction
  const unsignedTx = await directMintService.getUnsignedMintTransaction(
    collection.contractAddress,
    tokenId,
    uri,
    mintPrice.toString(),
    deadline,
    signature,
    userAddress
  );

  return { unsignedTx };
}; */

/* const createOrder = async (trx: any, params: any) => {
  const { collection, user, externalData, mintPrice, feeRate, userLayerId } =
    params;

  if (
    collection.type === "INSCRIPTION" ||
    collection.type === "RECURSIVE_INSCRIPTION"
  ) {
    const order = await orderRepository.create(trx, {
      userId: user.id,
      collectionId: collection.id,
      feeRate,
      orderType: "LAUNCH_BUY",
      fundingAmount: externalData.totalAmount,
      fundingAddress: externalData.funder.address,
      privateKey: externalData.funder.privateKey,
      userLayerId
    });

    return {
      order: hideSensitiveData(order, ["privateKey"]),
      singleMintTxHex: null
    };
  } else {
    const order = await orderRepository.create(trx, {
      userId: user.id,
      collectionId: collection.id,
      feeRate,
      orderType: "LAUNCH_BUY",
      fundingAmount: parseInt(externalData.unsignedTx.value.toString()),
      fundingAddress: externalData.unsignedTx.to?.toString(),
      privateKey: "evm",
      userLayerId
    });

    return {
      order: hideSensitiveData(order, ["privateKey"]),
      singleMintTxHex: serializeBigInt(externalData.unsignedTx)
    };
  }
}; */

// const handleInscriptionMint = async (params: any) => {
//   const { collection, launchItem, user, mintPrice, verification } = params;
//   if (!verification?.orderId) {
//     throw new CustomError("You must provide orderId for this operation.", 400);
//   }

//   // Get L2 collection and order data
//   const [L2Collection, order] = await Promise.all([
//     collectionRepository.getChildCollectionByParentCollectionId(
//       db,
//       collection.id
//     ),
//     orderRepository.getById(db, verification.orderId)
//   ]);

//   if (!L2Collection?.contractAddress || !L2Collection?.creatorUserLayerId)
//     throw new CustomError("Child collection not found.", 400);
//   if (!order?.fundingAddress || !order?.privateKey)
//     throw new CustomError(
//       "Order has invalid funding address and private key.",
//       400
//     );

//   // Get collectible data
//   const collectible = await collectibleRepository.getById(
//     db,
//     launchItem.collectibleId
//   );
//   if (!collectible?.fileKey)
//     throw new CustomError("Collectible file key not found.", 400);

//   // Create inscription
//   const vault = await createFundingAddress("TESTNET");
//   const file = await getObjectFromS3(collectible.fileKey);

//   const inscriptionData = {
//     address: vault.address,
//     opReturnValues: `data:${file.contentType};base64,${(
//       file.content as Buffer
//     ).toString("base64")}` as any
//   };

//   // Execute blockchain operations
//   const { commitTxHex, revealTxHex } = await inscribe(
//     inscriptionData,
//     order.fundingAddress,
//     order.privateKey,
//     true,
//     order.feeRate
//   );

//   const commitTxResult = await sendRawTransaction(commitTxHex);
//   if (!commitTxResult)
//     throw new CustomError("Could not broadcast the commit tx.", 400);

//   const revealTxResult = await sendRawTransaction(revealTxHex);
//   if (!revealTxResult)
//     throw new CustomError("Could not broadcast the reveal tx.", 400);

//   const inscriptionId = revealTxResult + "i0";

//   // Mint NFT
//   const mintTxId = await nftService.mintWithInscriptionId(
//     L2Collection.contractAddress,
//     user.address,
//     inscriptionId,
//     collectible.nftId,
//     mintPrice
//   );

//   if (!mintTxId)
//     throw new CustomError("Failed to mint NFT with inscription ID", 400);

//   return {
//     collectible,
//     L2Collection,
//     vault,
//     mintTxId,
//     revealTxResult,
//     inscriptionId,
//     type: "INSCRIPTION"
//   };
// };

// const handleIpfsMint = async (params: any) => {
//   const { collection, launchItem, user, mintPrice, verification } = params;

//   if (!verification?.txid || !verification?.orderId)
//     throw new CustomError(
//       "You must provide mint txid and orderId for this operation.",
//       400
//     );
//   if (!collection.contractAddress)
//     throw new CustomError("Contract address must be provided", 400);

//   // Verify transaction
//   const transactionDetail = await confirmationService.getTransactionDetails(
//     verification.txid
//   );
//   if (transactionDetail.status !== 1)
//     throw new CustomError("Transaction not confirmed. Please try again.", 500);

//   // Get collectible data
//   const collectible = await collectibleRepository.getById(
//     db,
//     launchItem.collectibleId
//   );
//   if (!collectible?.fileKey)
//     throw new CustomError("File key must be provided", 400);

//   // Handle IPFS upload if needed
//   let nftIpfsUrl = collectible.cid;
//   if (!nftIpfsUrl) {
//     if (collection.type === "IPFS_FILE") {
//       nftIpfsUrl = await nftService.uploadS3FileToIpfs(
//         collectible.fileKey,
//         collectible.name || "Unnamed NFT"
//       );
//     } else {
//       throw new CustomError("File has not been uploaded to the ipfs.", 400);
//     }
//   }

//   // Mint NFT
//   await nftService.mintIpfsNFTUsingVault(
//     collection.contractAddress,
//     user.address,
//     collectible.nftId,
//     nftIpfsUrl,
//     mintPrice
//   );

//   return {
//     collectible,
//     nftIpfsUrl,
//     txid: verification.txid,
//     type: "IPFS"
//   };
// };

/* export const updateMintRecords = async (trx: any, params: any) => {
  const { collection, launch, user, launchItem, mintData, verification } =
    params;

  if (mintData.type === "INSCRIPTION") {
    await updateInscriptionRecords(trx, mintData);
  } else {
    await updateIpfsRecords(trx, mintData);
  }

  // Common updates
  await collectionRepository.incrementCollectionSupplyById(trx, collection.id);
  if (collection.status === "UNCONFIRMED") {
    await collectionRepository.update(trx, collection.id, {
      status: "CONFIRMED"
    });
  }

  // Update launch item and create purchase record
  const soldLaunchItem = await launchItemRepository.update(trx, launchItem.id, {
    status: "SOLD"
  });

  await purchaseRepository.create(trx, {
    userId: user.id,
    launchItemId: soldLaunchItem.id,
    purchasedAddress: user.address
  });

  // Update order status
  await orderRepository.update(trx, verification.orderId, {
    orderStatus: "DONE"
  });
};

const updateInscriptionRecords = async (trx: any, mintData: any) => {
  const {
    collectible,
    L2Collection,
    vault,
    mintTxId,
    revealTxResult,
    inscriptionId
  } = mintData;

  await Promise.all([
    collectibleRepository.create(trx, {
      name: collectible.name,
      collectionId: L2Collection.id,
      uniqueIdx: L2Collection.contractAddress + "i" + collectible.nftId,
      nftId: collectible.nftId,
      mintingTxId: mintTxId,
      parentCollectibleId: collectible.id,
      fileKey: collectible.fileKey,
      status: "CONFIRMED",
      highResolutionImageUrl: collectible.highResolutionImageUrl
    }),

    collectibleRepository.update(trx, collectible.id, {
      lockingAddress: vault.address,
      lockingPrivateKey: vault.privateKey,
      mintingTxId: revealTxResult,
      uniqueIdx: inscriptionId,
      status: "CONFIRMED"
    }),

    collectionRepository.incrementCollectionSupplyById(trx, L2Collection.id)
  ]);

  if (L2Collection.status === "UNCONFIRMED") {
    await collectionRepository.update(trx, L2Collection.id, {
      status: "CONFIRMED"
    });
  }
};

const updateIpfsRecords = async (trx: any, mintData: any) => {
  const { collectible, nftIpfsUrl, txid, collection } = mintData;

  await collectibleRepository.update(trx, collectible.id, {
    status: "CONFIRMED",
    mintingTxId: txid,
    cid: nftIpfsUrl,
    uniqueIdx: collection.contractAddress + "i" + collectible.nftId
  });
}; */
