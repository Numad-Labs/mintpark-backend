import { EVM_CONFIG } from "../blockchain/evm/evm-config";
import { TransactionConfirmationService } from "../blockchain/evm/services/transactionConfirmationService";
import { CustomError } from "../exceptions/CustomError";
import { hideSensitiveData } from "../libs/hideDataHelper";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { listRepository } from "../repositories/listRepository";
import { userRepository } from "../repositories/userRepository";
import MarketplaceService from "../blockchain/evm/services/marketplaceService";
import { ethers } from "ethers";
import { serializeBigInt } from "../blockchain/evm/utils";
import { collectionRepository } from "../repositories/collectionRepository";

import { db } from "../utils/db";
import { layerRepository } from "../repositories/layerRepository";
import { userLayerRepository } from "../repositories/userLayerRepository";
import logger from "../config/winston";
import subgraphService from "@blockchain/evm/services/subgraph/subgraphService";
import { LIST_STATUS } from "@app-types/db/enums";

export const listServices = {
  checkAndPrepareRegistration: async (
    collectionId: string,
    issuerId: string,
    userLayerId: string,
    tokenId: string
  ) => {
    const issuer = await userRepository.getByUserLayerId(userLayerId);
    if (!issuer) throw new CustomError("User not found.", 400);
    if (!issuer.isActive)
      throw new CustomError("This account is deactivated.", 400);
    if (issuer.id !== issuerId)
      throw new CustomError("You are not allowed to do this action.", 400);

    const collection = await collectionRepository.getById(db, collectionId);
    if (!collection) throw new CustomError("Collection not found.", 400);
    const layer = await layerRepository.getById(collection.layerId);
    if (!layer || !layer.chainId)
      throw new CustomError("Layer or chainid not found", 400);
    if (issuer.layerId !== collection?.layerId)
      throw new CustomError(
        "Please connect to the appropriate L2 for this listing.",
        400
      );

    const chainConfig = EVM_CONFIG.CHAINS[layer.chainId];
    const marketplaceService = new MarketplaceService(
      chainConfig.MARKETPLACE_ADDRESS,
      chainConfig.RPC_URL
    );

    // const listings = await marketplaceService.getAllListings();
    // const tokenListings = listings.filter(
    //   (listing) =>
    //     listing.nftContract.toLowerCase() ===
    //       collection.contractAddress?.toLowerCase() &&
    //     listing.tokenId === Number(tokenId) &&
    //     listing.isActive
    // );

    // // If there are active listings for this token, it means it's already listed
    // const isAlreadyListed = tokenListings.length > 0;

    const uniqueIdx = `${collection.contractAddress}i${tokenId}`;

    const collectible = await collectibleRepository.getByUniqueIdx(uniqueIdx);
    if (!collectible)
      throw new CustomError(`Could not find collectible ${tokenId}`, 400);
    console.log("🚀 ~ collectible.id:", collectible.id);
    const listing = await listRepository.getByCollectibleId(collectible.id);
    console.log("🚀 ~ listing:", listing);
    if (!collection.contractAddress)
      throw new CustomError(
        "Contract address not found in the collection",
        400
      );

    if (listing) {
      // For collectibles that have been listed before, check if they
      // have an active listing on-chain that our DB missed

      // const existingListing = await listRepository.getByCollectibleId(
      //   listing.id
      // );

      const tokenActivity = await subgraphService.getTokenActivity(
        layer.layer,
        parseInt(layer.chainId),
        collection.contractAddress,
        tokenId
      );
      // If we don't have an active listing in our DB, check if there's one on-chain
      // by analyzing the token activities
      if (
        tokenActivity &&
        tokenActivity.activities &&
        tokenActivity.activities.length > 0
      ) {
        // First find all created listings
        const createdListings = tokenActivity.activities
          .filter((activity) => activity.type === "CREATED")
          .sort(
            (a, b) => parseInt(b.blockTimestamp) - parseInt(a.blockTimestamp)
          ); // Sort by newest first

        // For each created listing, check if it's been cancelled or sold
        for (const createdListing of createdListings) {
          const listingId = createdListing.listingId;

          // Check if this listing has been cancelled
          const isCancelled = tokenActivity.activities.some(
            (activity) =>
              activity.type === "CANCELLED" && activity.listingId === listingId
          );

          // Check if this listing has been sold
          const isSold = tokenActivity.activities.some(
            (activity) =>
              activity.type === "SOLD" && activity.listingId === listingId
          );

          // If the listing is neither cancelled nor sold, it's still active
          if (!isCancelled && !isSold) {
            // Add the listing to our database if it doesn't exist
            const existingListing = listing;

            if (!existingListing) {
              // Create a new listing record in our database
              await listRepository.create(db, {
                collectibleId: collectible.id,
                sellerId: "", // Unknown seller ID - could attempt to resolve
                address: "", // Unknown address
                privateKey: listingId,
                onchainListingId: listingId,
                price: parseFloat(createdListing.price),
                status: LIST_STATUS.ACTIVE,
                listedAt: new Date(
                  parseInt(createdListing.blockTimestamp) * 1000
                )
              });
            } else if (existingListing.status !== LIST_STATUS.ACTIVE) {
              // Update the existing listing to be active
              await listRepository.updateListingStatus(
                db,
                existingListing.id,
                LIST_STATUS.ACTIVE
              );
            }

            return {
              isRegistered: true,
              listingId: existingListing ? existingListing.id : null,
              message: "This token is already listed in the marketplace.",
              onChainListingId: listingId
            };
          }
        }
      }
    }

    return {
      isRegistered: false
    };
  },
  listCollectible: async (
    price: number,
    collectibleId: string,
    issuerId: string,
    txid?: string
  ) => {
    const collectible = await collectibleRepository.getById(db, collectibleId);
    if (!collectible || !collectible.collectionId)
      throw new CustomError("Collectible not found.", 400);

    const collection = await collectionRepository.getById(
      db,
      collectible?.collectionId
    );
    if (!collection) throw new CustomError("Collectible not found.", 400);
    // if (collection.status !== "CONFIRMED")
    //   throw new CustomError("This collection cannot be listed yet.", 400);
    if (
      collection.type === "INSCRIPTION" ||
      collection.type === "RECURSIVE_INSCRIPTION"
    )
      throw new CustomError("This collection type is not supported.", 400);

    const issuer = await userRepository.getByIdAndLayerId(
      issuerId,
      collection.layerId
    );
    if (!issuer || !issuer.isActive)
      throw new CustomError(
        "Please connect to appropriate L2 for this listing.",
        400
      );

    let list;

    const layer = await layerRepository.getById(collection.layerId);
    if (!layer) throw new CustomError("Layer not found", 400);
    if (!layer.chainId) throw new CustomError("Layer chainid not found", 400);

    const chainConfig = EVM_CONFIG.CHAINS[layer.chainId];
    const marketplaceService = new MarketplaceService(
      chainConfig.MARKETPLACE_ADDRESS,
      chainConfig.RPC_URL
    );
    const confirmationService = new TransactionConfirmationService(
      chainConfig.RPC_URL
    );

    return await db.transaction().execute(async (trx) => {
      if (collectible.layerType === "EVM") {
        if (!collection || !collection.contractAddress)
          throw new CustomError("Contract address not found.", 400);

        // Check if token is already listed
        const listings = await marketplaceService.getAllListings();
        const activeListings = listings.filter(
          (listing) =>
            listing.nftContract.toLowerCase() ===
              collection.contractAddress?.toLowerCase() &&
            listing.tokenId === Number(collectible.nftId) &&
            listing.isActive
        );
        if (activeListings.length > 0) {
          throw new CustomError(
            "This token is already listed in the marketplace.",
            400
          );

          // create new listing(listingId, price, sellerId)
          // or find pending list with the contractAddress && nftId, verify price & seller address -> update status to ACTIVE
        }

        if (!layer.chainId)
          throw new CustomError("Layer chainid not found", 400);

        // Check marketplace approval using NFT service
        const isApproved = await marketplaceService.checkMarketplaceApproval(
          collection.contractAddress,
          issuer.address,
          layer.chainId
        );

        if (!isApproved) {
          if (!txid) throw new CustomError("txid is missing", 400);
          const transactionDetail =
            await confirmationService.getTransactionDetails(txid);
          if (transactionDetail.status !== 1) {
            throw new CustomError(
              "Transaction not confirmed. Please try again.",
              500
            );
          }
        }

        if (!collectible.uniqueIdx)
          throw new CustomError(
            "Collectible with no unique index cannot be listed.",
            400
          );
        const tokenId = collectible.nftId;

        const priceInEther = price.toString();

        const { transaction: createListingTx, expectedListingId } =
          await marketplaceService.createListingTransaction(
            collection.contractAddress,
            tokenId,
            priceInEther,
            issuer.address
          );

        // const preparedListingTx = await nftService.prepareUnsignedTransaction(
        //   createListingTx,
        //   issuer.address
        // );

        const serializedTx = serializeBigInt(createListingTx);

        list = await listRepository.create(trx, {
          collectibleId: collectible.id,
          sellerId: issuer.id,
          address: issuer.address,
          onchainListingId: expectedListingId,
          price: price

          // inscribedAmount: price,
        });

        const sanitizedList = hideSensitiveData(list, [
          "privateKey",
          "vaultTxid",
          "vaultVout"
        ]);

        return { sanitizedList, preparedListingTx: serializedTx };
      } else throw new CustomError("Unsupported layer.", 400);
    });
  },
  confirmPendingList: async (
    id: string,
    txid: string,
    vout: number,
    inscribedAmount: number,
    issuerId: string
  ) => {
    const list = await listRepository.getById(id);
    if (!list) throw new CustomError("No list found.", 400);
    if (list.status !== "PENDING")
      throw new CustomError("This list is could not be confirmed.", 400);
    if (list.sellerId !== issuerId)
      throw new CustomError(
        "You are not allowed to confirm this listing.",
        400
      );
    if (!list.chainId) throw new CustomError("chainid not found", 400);

    const collectible = await collectibleRepository.getById(
      db,
      list.collectibleId
    );
    if (!collectible) throw new CustomError("Collectible not found.", 400);
    if (!collectible.uniqueIdx)
      throw new CustomError("Collectible uniqueIdx not found", 400);
    const contractAddress = collectible.uniqueIdx.split("i")[0];
    const tokenId = collectible.uniqueIdx.split("i")[1];

    const chainConfig = EVM_CONFIG.CHAINS[list.chainId];
    const confirmationService = new TransactionConfirmationService(
      chainConfig.RPC_URL
    );

    return await db.transaction().execute(async (trx) => {
      if (list.layerType === "EVM") {
        if (!txid) throw new CustomError("txid is missing", 400);

        let onchainListingId = list.privateKey
          ? list.privateKey
          : list.onchainListingId;
        if (!onchainListingId)
          throw new Error("Listing with no onchainListingId.");

        await confirmationService.validateCreateListingTransaction(
          txid,
          contractAddress,
          tokenId,
          list.address,
          list.price.toString(),
          onchainListingId
        );

        const updatedList = await listRepository.update(trx, list.id, {
          status: "ACTIVE",
          vaultTxid: txid,
          vaultVout: 0,
          inscribedAmount: inscribedAmount
        });

        const sanitizedList = hideSensitiveData(updatedList, [
          "privateKey",
          "vaultTxid",
          "vaultVout"
        ]);

        return sanitizedList;
      }
      // else if (list.layer === "FRACTAL") {
      //   if (!list.uniqueIdx)
      //     throw new CustomError(
      //       "Collectible with no unique index cannot be listed.",
      //       400
      //     );
      //   const inscription = await getInscriptionInfo(list.uniqueIdx);
      //   if (!inscription)
      //     throw new CustomError(
      //       "Invalid inscriptionId, this inscription cant be sold.",
      //       400
      //     );
      //   if (inscription.address !== list.address)
      //     throw new CustomError(
      //       "Collectible has not been transferred yet.",
      //       400
      //     );
      //   if (!inscription.utxo.satoshi)
      //     throw new CustomError("No inscription satoshi amount found.", 400);
      //   if (inscription.utxo.satoshi !== inscribedAmount)
      //     throw new CustomError("Invalid inscribed amount.", 400);
      // }
      else throw new CustomError("Unsupported layer.", 400);

      // const updatedList = await listRepository.update(trx, list.id, {
      //   status: "ACTIVE",
      //   vaultTxid: txid,
      //   vaultVout: vout,
      //   inscribedAmount: inscribedAmount,
      // });

      // const sanitizedList = hideSensitiveData(updatedList, [
      //   "privateKey",
      //   "vaultTxid",
      //   "vaultVout",
      // ]);

      // return sanitizedList;
    });
  },
  generateBuyTxHex: async (
    id: string,
    userLayerId: string,
    feeRate: number,
    issuerId: string
  ) => {
    const list = await listRepository.getById(id);
    if (!list) throw new CustomError("No list found.", 400);
    if (list.status !== "ACTIVE")
      throw new CustomError("This list is could not be bought.", 400);

    // const seller = await userRepository.getByUserLayerId(list.sellerId);
    // if (!seller) throw new CustomError("Seller not found.", 400);

    const buyer = await userRepository.getByUserLayerId(userLayerId);
    if (!buyer) throw new CustomError("User not found.", 400);
    if (!buyer.isActive)
      throw new CustomError("This account is deactivated.", 400);
    // if (buyer.address === seller.address)
    //   throw new CustomError("You cannot buy your own listing.", 400);

    if (list.layerType === "EVM") {
      const collectible = await collectibleRepository.getById(
        db,
        list.collectibleId
      );
      if (!collectible) throw new CustomError("Collectible not found", 400);
      if (!collectible.uniqueIdx)
        throw new CustomError(
          "Collectible with no unique index cannot be listed.",
          400
        );

      const collection = await collectionRepository.getById(
        db,
        collectible.collectionId
      );
      if (!collection || !collection.contractAddress)
        throw new CustomError("Collection not found", 400);
      if (collection.status !== "CONFIRMED")
        throw new CustomError("Collection is not confirmed", 400);

      const layer = await layerRepository.getById(collection.layerId);
      if (!layer || !layer.chainId)
        throw new CustomError("Layer or chainid not found", 400);

      let onchainListingId = list.privateKey
        ? list.privateKey
        : list.onchainListingId;

      if (!onchainListingId)
        throw new Error("Listing with no onchainListingId.");

      // // Check on-chain status first
      // const syncService = new MarketplaceSyncService(db, subgraphService);
      // const listingState =
      //   await syncService.checkAndSyncListing(onchainListingId);

      // // If listing was already sold
      // if (listingState.onChainStatus === "SOLD") {
      //   throw new CustomError("This item has already been sold.", 400);
      // }

      // // If listing was already cancelled
      // if (listingState.onChainStatus === "CANCELLED") {
      //   throw new CustomError(
      //     "This listing has been cancelled by the seller.",
      //     400
      //   );
      // }

      // // If listing doesn't exist on-chain but our DB says it's active
      // if (
      //   listingState.onChainStatus === null &&
      //   list.status === LIST_STATUS.ACTIVE
      // ) {
      //   // Update our database
      //   await db
      //     .updateTable("List")
      //     .set({
      //       status: LIST_STATUS.CANCELLED
      //     })
      //     .where("id", "=", id)
      //     .execute();

      //   throw new CustomError(
      //     "This listing is no longer available on the marketplace.",
      //     400
      //   );
      // }

      // // Now continue with the rest of your buying logic
      // if (list.status !== LIST_STATUS.ACTIVE) {
      //   throw new CustomError("This listing could not be bought.", 400);
      // }

      const chainConfig = EVM_CONFIG.CHAINS[layer.chainId];
      const marketplaceService = new MarketplaceService(
        chainConfig.MARKETPLACE_ADDRESS,
        chainConfig.RPC_URL
      );

      // FCFS or Public phase - no merkle proof needed
      return serializeBigInt(
        await marketplaceService.buyListingTransaction(
          collection.contractAddress,
          collectible.nftId,
          parseInt(onchainListingId),
          // [],
          list.price.toString(),
          buyer.address
        )
      );

      // return serializeBigInt(unsignedHex);
    }
    // else if (list.layer === "FRACTAL") {
    //   if (!list.inscribedAmount)
    //     throw new CustomError("Invalid inscribed amount.", 400);

    //   if (!buyer.pubkey || !list.vaultTxid || list.vaultVout === null)
    //     throw new CustomError("Invalid fields.", 400);

    //   const serviceFee = Math.min(
    //     list.price * LISTING_SERVICE_FEE_PERCENTAGE,
    //     MINIMUM_LISTING_SERVICE_FEE
    //   );

    //   const txHex = await generateBuyPsbtHex(
    //     {
    //       buyerAddress: buyer.address,
    //       buyerPubKey: buyer.pubkey,
    //       sellerAddress: seller.address,
    //       vaultAddress: list.address,
    //       vaultTxid: list.vaultTxid,
    //       vaultVout: list.vaultVout,
    //       vaultPrivateKey: list.privateKey,
    //       inscribedAmount: list.inscribedAmount,
    //       listedPrice: list.price,
    //       serviceFee: serviceFee,
    //     },
    //     feeRate,
    //     true
    //   );

    //   return txHex;
    // }
    else throw new CustomError("Unsupported layer.", 400);
  },
  // updateListedCollectible: async (id: string, issuerId: string) => {
  //   const list = await listRepository.getById(id);
  //   if (!list) throw new CustomError("No list found.", 400);
  //   const buyer = await userRepository.getById(issuerId);
  //   if (!buyer) throw new CustomError("User not found.", 400);
  //   const marketplaceContract =
  //     await marketplaceService.getEthersMarketplaceContract();

  //   const txHex = await marketplaceContract.buyFromListing.populateTransaction(
  //     list.uniqueIdx.split("i")[1],
  //     buyer.address,
  //     1,
  //     ethers.ZeroAddress, // ETH as currency
  //     ethers.parseEther(list.price.toString()) // Price from metadata
  //   );
  //   const unsignedHex = await nftService.prepareUnsignedTransaction(
  //     txHex,
  //     buyer.address
  //   );

  //   const serializedTx = serializeBigInt(unsignedHex);

  //   return serializedTx;
  // },
  buyListedCollectible: async (
    id: string,
    userLayerId: string,
    hex: string,
    issuerId: string,
    txid?: string
  ) => {
    const buyer = await userRepository.getByUserLayerId(userLayerId);
    if (!buyer) throw new CustomError("User not found.", 400);
    if (!buyer.isActive)
      throw new CustomError("This account is deactivated.", 400);

    const list = await listRepository.getById(id);
    if (!list) throw new CustomError("No list found.", 400);
    if (list.status !== "ACTIVE")
      throw new CustomError("This list is could not be bought.", 400);

    const collectible = await collectibleRepository.getById(
      db,
      list.collectibleId
    );
    if (!collectible) throw new CustomError("Collectible not found.", 400);
    if (!collectible.uniqueIdx)
      throw new CustomError("Collectible uniqueIdx not found", 400);
    const contractAddress = collectible.uniqueIdx.split("i")[0];
    const tokenId = collectible.uniqueIdx.split("i")[1];

    // const seller = await userRepository.getByIdAndLayerId(
    //   list.sellerId,
    //   layerId
    // );
    // if (!seller) throw new CustomError("Seller not found.", 400);
    if (!list.chainId) throw new CustomError("chainid not found", 400);
    const chainConfig = EVM_CONFIG.CHAINS[list.chainId];

    const confirmationService = new TransactionConfirmationService(
      chainConfig.RPC_URL
    );

    return await db.transaction().execute(async (trx) => {
      if (list.layerType === "EVM") {
        if (!txid) throw new CustomError("txid is missing", 400);
        const isConfirmed = await confirmationService.validateBuyTransaction(
          txid,
          buyer.address,
          list.address, // listing seller address
          contractAddress,
          tokenId,
          list.price.toString()
        );
        if (!isConfirmed) {
          throw new CustomError(
            "Transaction not confirmed. Please try again.",
            500
          );
        }

        logger.info(`Listing sold`, {
          txid,
          buyerAddress: buyer.address,
          sellerAddress: list.address, // listing seller address
          contractAddress,
          tokenId,
          listingPrice: list.price.toString()
        });
        const confirmedList = await listRepository.update(trx, list.id, {
          status: "SOLD",
          soldAt: new Date().toISOString()
        });
        const buyTxId = txid;
        return { txid: buyTxId, confirmedList };
      }
      // else if (list.layer === "FRACTAL") {
      //   const buyTxId = await validateSignAndBroadcastBuyPsbtHex(
      //     hex,
      //     list.privateKey,
      //     seller.address,
      //     list.price
      //   );
      //   if (!buyTxId) throw new CustomError("Invalid psbt.", 400);

      //   const confirmedList = await listRepository.update(trx, list.id, {
      //     status: "SOLD",
      //     soldAt: new Date().toISOString(),
      //   });

      //   return { txid: buyTxId, confirmedList };
      // }
      else throw new CustomError("Unsupported layer.", 400);
    });
  },
  generateListingCancelTx: async (issuerId: string, id: string) => {
    const list = await listRepository.getById(id);
    if (!list) throw new CustomError("List not found.", 400);
    const collectible = await collectibleRepository.getById(
      db,
      list.collectibleId
    );
    if (!collectible) throw new CustomError("Collectible not found.", 400);

    const seller = await userRepository.getByIdAndLayerId(
      list.sellerId,
      collectible.layerId
    );
    if (!seller) throw new CustomError("Seller not found.", 400);

    const issuerAddresses =
      await userLayerRepository.getActiveAddressesByUserIdAndLayerId(
        issuerId,
        collectible.layerId
      );
    if (!issuerAddresses.some((addrObj) => addrObj.address === seller.address))
      if (list.sellerId !== issuerId)
        throw new CustomError(
          "You are not allowed to cancel this listing.",
          400
        );

    if (!collectible.uniqueIdx) throw new CustomError("NFT ID is missing", 400);

    if (!collectible.chainId) throw new CustomError("chainid not found", 400);

    // let onchainListingId = list.privateKey
    //   ? list.privateKey
    //   : list.onchainListingId;

    // console.log(
    //   "🚀 ~ generateListingCancelTx: ~ onchainListingId:",
    //   onchainListingId
    // );
    // if (!onchainListingId) throw new Error("Listing with no onchainListingId.");

    // // Check on-chain status first

    // const syncService = new MarketplaceSyncService(db, subgraphService);
    // const dbListingId = list.id;

    // const listingState = await syncService.checkAndSyncListing(dbListingId);
    // console.log("🚀 ~ generateListingCancelTx: ~ listingState:", listingState);

    // // If the listing was already cancelled on-chain
    // if (listingState.onChainStatus === "CANCELLED") {
    //   // Just return a message - no need to sign another tx
    //   throw new CustomError("This listing has already been cancelled.", 400);
    // }

    // // If the listing was already sold on-chain
    // if (listingState.onChainStatus === "SOLD") {
    //   throw new CustomError(
    //     "This listing has already been sold and cannot be cancelled.",
    //     400
    //   );
    // }

    // // If the listing isn't active on-chain but our DB says it is
    // if (
    //   listingState.onChainStatus === null &&
    //   list.status === LIST_STATUS.ACTIVE
    // ) {
    //   // Update our database to match on-chain state
    //   await listRepository.updateListingStatus(db, id, LIST_STATUS.CANCELLED);

    //   throw new CustomError(
    //     "This listing could not be found on the blockchain. It has been marked as cancelled in our system.",
    //     400
    //   );
    // }

    const chainConfig = EVM_CONFIG.CHAINS[collectible.chainId];
    const marketplaceService = new MarketplaceService(
      chainConfig.MARKETPLACE_ADDRESS,
      chainConfig.RPC_URL
    );

    const txHex = serializeBigInt(
      await marketplaceService.cancelListingTransaction(
        collectible.uniqueIdx.split("i")[0],
        collectible.uniqueIdx.split("i")[1],
        list.address
      )
    );

    return txHex;
  },
  confirmListingCancel: async (issuerId: string, id: string, txid: string) => {
    const list = await listRepository.getById(id);
    if (!list) throw new CustomError("List not found.", 400);
    const collectible = await collectibleRepository.getById(
      db,
      list.collectibleId
    );
    if (!collectible) throw new CustomError("Collectible not found.", 400);

    const seller = await userRepository.getByIdAndLayerId(
      list.sellerId,
      collectible.layerId
    );
    if (!seller) throw new CustomError("Seller not found.", 400);

    const issuerAddresses =
      await userLayerRepository.getActiveAddressesByUserIdAndLayerId(
        issuerId,
        collectible.layerId
      );
    if (!issuerAddresses.some((addrObj) => addrObj.address === seller.address))
      if (list.sellerId !== issuerId)
        throw new CustomError(
          "You are not allowed to cancel this listing.",
          400
        );

    // Transaction validation
    if (!txid) {
      throw new CustomError("Transaction ID is required", 400);
    }

    if (!collectible.chainId) throw new CustomError("Chain ID not found", 400);

    const chainConfig = EVM_CONFIG.CHAINS[collectible.chainId];
    const confirmationService = new TransactionConfirmationService(
      chainConfig.RPC_URL
    );

    try {
      // Get basic transaction details first
      const transactionDetail =
        await confirmationService.getTransactionDetails(txid);
      if (transactionDetail.status !== 1) {
        throw new CustomError(
          "Transaction not confirmed. Please try again.",
          400
        );
      }

      let onchainListingId = list.privateKey
        ? list.privateKey
        : list.onchainListingId;
      if (!onchainListingId)
        throw new Error("Listing with no onchainListingId.");

      // Validate the cancellation transaction
      // We need to verify that the listing ID in the event matches with the one stored
      await confirmationService.validateListingCancellation(
        txid,
        onchainListingId,
        seller.address
      );

      // If validation passes, update listing
      const canceledListing = await listRepository.cancelListingsById(db, id);

      return canceledListing;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(
        `Failed to validate listing cancellation: ${error}`,
        400
      );
    }
  }
  // estimateFee: async (id: string, feeRate: number) => {
  //   const list = await listRepository.getById(id);
  //   if (!list) throw new CustomError("Listing not found.", 400);

  //   const inscribedAmount = list.inscribedAmount || 546;

  //   const estimation = await estimateBuyPsbtRequiredAmount(
  //     list.price,
  //     inscribedAmount,
  //     feeRate
  //   );

  //   return estimation;
  // },
};
