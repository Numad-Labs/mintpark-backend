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
import { launchRepository } from "../repositories/launchRepository";
import { layerRepository } from "../repositories/layerRepository";
import { userLayerRepository } from "../repositories/userLayerRepository";
// import { merkleService } from "../blockchain/evm/services/merkleTreeService";

// import MarketplaceService from "./marketplaceService";
// const marketplaceService = new MarketplaceService(
//   EVM_CONFIG.MARKETPLACE_ADDRESS
// );

// const confirmationService = new TransactionConfirmationService(
//   EVM_CONFIG.RPC_URL
// );

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

    const listings = await marketplaceService.getAllListings();
    const tokenListings = listings.filter(
      (listing) =>
        listing.nftContract.toLowerCase() ===
          collection.contractAddress?.toLowerCase() &&
        listing.tokenId === Number(tokenId) &&
        listing.isActive
    );

    // If there are active listings for this token, it means it's already listed
    const isAlreadyListed = tokenListings.length > 0;

    if (isAlreadyListed) {
      const activeListingPrice = ethers.formatEther(tokenListings[0].price);
      return {
        isRegistered: true,
        currentListing: {
          listingId: tokenListings[0].listingId,
          price: activeListingPrice,
          seller: tokenListings[0].seller
        }
      };
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
    if (collection.status !== "CONFIRMED")
      throw new CustomError("This collection cannot be listed yet.", 400);
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
        // console.log(
        //   "🚀 ~ returnawaitdb.transaction ~ expectedListingId:",
        //   expectedListingId
        // );

        // const preparedListingTx = await nftService.prepareUnsignedTransaction(
        //   createListingTx,
        //   issuer.address
        // );

        const serializedTx = serializeBigInt(createListingTx);

        list = await listRepository.create(trx, {
          collectibleId: collectible.id,
          sellerId: issuer.id,
          address: issuer.address,
          privateKey: expectedListingId,
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

    const chainConfig = EVM_CONFIG.CHAINS[list.chainId];
    const confirmationService = new TransactionConfirmationService(
      chainConfig.RPC_URL
    );

    return await db.transaction().execute(async (trx) => {
      if (list.layerType === "EVM") {
        if (!txid) throw new CustomError("txid is missing", 400);
        const transactionDetail =
          await confirmationService.getTransactionDetails(txid);
        if (transactionDetail.status !== 1) {
          throw new CustomError(
            "Transaction not confirmed. Please try again.",
            400
          );
        }
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

      // const listingData = await marketplaceContract.getListing(
      //   collectible.uniqueIdx.split("i")[0],
      //   collectible.uniqueIdx.split("i")[1]
      // );
      // if (!listingData.isActive) {
      //   throw new CustomError("Listing no longer active", 400);
      // }

      // const txHex = await marketplaceContract.buyItem.populateTransaction(
      //   collectible.uniqueIdx.split("i")[0], // NFT contract
      //   collectible.uniqueIdx.split("i")[1], // token ID
      //   {
      //     value: ethers.parseEther(list.price.toString()),
      //   }
      // );

      // const unsignedHex = await nftService.prepareUnsignedTransaction(
      //   txHex,
      //   buyer.address
      // );
      const layer = await layerRepository.getById(collection.layerId);
      if (!layer || !layer.chainId)
        throw new CustomError("Layer or chainid not found", 400);

      const chainConfig = EVM_CONFIG.CHAINS[layer.chainId];
      const marketplaceService = new MarketplaceService(
        chainConfig.MARKETPLACE_ADDRESS,
        chainConfig.RPC_URL
      );

      // console.log("🚀 ~ list.price:", list.price);
      // console.log("Listing price:", list.price.toString());
      // console.log("Sending price:", ethers.parseEther(list.price.toString()));
      // FCFS or Public phase - no merkle proof needed
      return serializeBigInt(
        await marketplaceService.buyListingTransaction(
          collection.contractAddress,
          collectible.nftId,
          parseInt(list.privateKey),
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

    // const seller = await userRepository.getByIdAndLayerId(
    //   list.sellerId,
    //   layerId
    // );
    // if (!seller) throw new CustomError("Seller not found.", 400);
    if (!list.chainId) throw new CustomError(" chainid not found", 400);
    const chainConfig = EVM_CONFIG.CHAINS[list.chainId];

    const confirmationService = new TransactionConfirmationService(
      chainConfig.RPC_URL
    );

    return await db.transaction().execute(async (trx) => {
      if (list.layerType === "EVM") {
        if (!txid) throw new CustomError("txid is missing", 400);
        const transactionDetail =
          await confirmationService.getTransactionDetails(txid);
        if (transactionDetail.status !== 1) {
          throw new CustomError(
            "Transaction not confirmed. Please try again.",
            500
          );
        }
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
  confirmListingCancel: async (issuerId: string, id: string) => {
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

    const canceledListing = await listRepository.cancelListingsById(db, id);

    return canceledListing;
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
