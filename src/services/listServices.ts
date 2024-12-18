import { EVM_CONFIG } from "../../blockchain/evm/evm-config";
import { TransactionConfirmationService } from "../../blockchain/evm/services/transactionConfirmationService";
import {
  generateBuyPsbtHex,
  validateSignAndBroadcastBuyPsbtHex,
} from "../../blockchain/utxo/fractal/buyPsbt";
import { getInscriptionInfo } from "../../blockchain/utxo/fractal/libs";
import { createFundingAddress } from "../../blockchain/utxo/fundingAddressHelper";
import { CustomError } from "../exceptions/CustomError";
import {
  LISTING_SERVICE_FEE_PERCENTAGE,
  MINIMUM_LISTING_SERVICE_FEE,
} from "../libs/constants";
import { hideSensitiveData } from "../libs/hideDataHelper";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { listRepository } from "../repositories/listRepository";
import { userRepository } from "../repositories/userRepository";
import MarketplaceService from "../../blockchain/evm/services/marketplaceService";
import { ethers } from "ethers";
import NFTService from "../../blockchain/evm/services/nftService";
import { serializeBigInt } from "../../blockchain/evm/utils";
import { collectionRepository } from "../repositories/collectionRepository";

import { db } from "../utils/db";
import { launchRepository } from "../repositories/launchRepository";
import { merkleService } from "../../blockchain/evm/services/merkleTreeService";

// import MarketplaceService from "./marketplaceService";
const marketplaceService = new MarketplaceService(
  EVM_CONFIG.MARKETPLACE_ADDRESS
);

const confirmationService = new TransactionConfirmationService(
  EVM_CONFIG.RPC_URL
);
const nftService = new NFTService(
  EVM_CONFIG.RPC_URL,
  EVM_CONFIG.MARKETPLACE_ADDRESS,
  new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS)
);

export const listServices = {
  checkAndPrepareRegistration: async (
    collectionAddress: string,
    issuerId: string
  ) => {
    const issuer = await userRepository.getById(issuerId);
    if (!issuer) throw new CustomError("User not found.", 400);

    // Check if collection is registered
    let isRegistered = false;
    try {
      const collectionConfig = await marketplaceService.getCollectionConfig(
        collectionAddress
      );
      isRegistered = collectionConfig?.isActive || false;
    } catch (error) {
      // Collection not registered - this is expected
      isRegistered = false;
    }

    if (!isRegistered) {
      // Prepare registration transaction
      const registerTx = await marketplaceService.registerCollectionTransaction(
        collectionAddress,
        EVM_CONFIG.DEFAULT_PUBLIC_MAX_MINT,
        issuer.address
      );

      return {
        isRegistered: false,
        registrationTx: serializeBigInt(registerTx),
      };
    }

    return {
      isRegistered: true,
    };
  },

  listCollectible: async (
    price: number,
    collectibleId: string,
    issuerId: string,
    txid?: string
  ) => {
    const collectible = await collectibleRepository.getById(collectibleId);
    if (!collectible || !collectible.collectionId)
      throw new CustomError("Collectible not found.", 400);

    const collection = await collectionRepository.getById(
      db,
      collectible?.collectionId
    );
    if (!collection) throw new CustomError("Collectible not found.", 400);

    const issuer = await userRepository.getByIdAndLayerId(
      issuerId,
      collection.layerId
    );
    if (!issuer) throw new CustomError("User not found.", 400);

    let list;

    return await db.transaction().execute(async (trx) => {
      if (collectible.layer === "CITREA") {
        if (!collection || !collection.contractAddress)
          throw new CustomError("Contract address not found.", 400);

        try {
          const collectionConfig = await marketplaceService.getCollectionConfig(
            collection.contractAddress
          );
          if (!collectionConfig?.isActive) {
            throw new CustomError(
              "Collection not registered. Please register collection first.",
              400
            );
          }
        } catch (error) {
          throw new CustomError(
            "Collection not registered. Please register collection first.",
            400
          );
        }

        const signer = await nftService.provider.getSigner();
        const nftContract = new ethers.Contract(
          collection.contractAddress,
          EVM_CONFIG.NFT_CONTRACT_ABI,
          signer
        );

        // Check if the marketplace is already approved
        const isApproved = await nftContract.isApprovedForAll(
          issuer.address,
          EVM_CONFIG.MARKETPLACE_ADDRESS
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
        const tokenId = collectible.uniqueIdx.split("i")[1];

        // Create listing transaction
        const createListingTx =
          await marketplaceService.createListingTransaction(
            collection.contractAddress,
            tokenId,
            price.toString(),
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
          privateKey: "evm",
          price: price,
          // inscribedAmount: price,
        });

        const sanitizedList = hideSensitiveData(list, [
          "privateKey",
          "vaultTxid",
          "vaultVout",
        ]);

        return { sanitizedList, preparedListingTx: serializedTx };
      } else if (collectible.layer === "FRACTAL") {
        if (!collectible.uniqueIdx)
          throw new CustomError(
            "Collectible with no unique index cannot be listed.",
            400
          );
        const inscription = await getInscriptionInfo(collectible.uniqueIdx);
        if (!inscription)
          throw new CustomError(
            "Invalid inscriptionId, this inscription cant be sold.",
            400
          );
        if (inscription.address !== issuer.address)
          throw new CustomError(
            "You are not the owner of this inscription.",
            400
          );
        if (!inscription.utxo.satoshi)
          throw new CustomError("No inscription satoshi amount found.", 400);

        const latestPendingList =
          await listRepository.getLatestPendingListByCollectibleId(
            trx,
            collectible.id
          );
        if (latestPendingList)
          await listRepository.cancelPendingListingsByCollectibleId(
            trx,
            collectible.id
          );

        const vault = createFundingAddress(
          collectible.layer,
          collectible.network
        );
        list = await listRepository.create(trx, {
          collectibleId: collectible.id,
          sellerId: issuer.id,
          address: vault.address,
          privateKey: vault.privateKey,
          price: price,
          inscribedAmount: inscription.utxo.satoshi,
        });

        const sanitizedList = hideSensitiveData(list, [
          "privateKey",
          "vaultTxid",
          "vaultVout",
        ]);

        return sanitizedList;
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

    return await db.transaction().execute(async (trx) => {
      if (list.layer === "CITREA") {
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
          inscribedAmount: inscribedAmount,
        });

        const sanitizedList = hideSensitiveData(updatedList, [
          "privateKey",
          "vaultTxid",
          "vaultVout",
        ]);

        return sanitizedList;
      } else if (list.layer === "FRACTAL") {
        if (!list.uniqueIdx)
          throw new CustomError(
            "Collectible with no unique index cannot be listed.",
            400
          );
        const inscription = await getInscriptionInfo(list.uniqueIdx);
        if (!inscription)
          throw new CustomError(
            "Invalid inscriptionId, this inscription cant be sold.",
            400
          );
        if (inscription.address !== list.address)
          throw new CustomError(
            "Collectible has not been transferred yet.",
            400
          );
        if (!inscription.utxo.satoshi)
          throw new CustomError("No inscription satoshi amount found.", 400);
        if (inscription.utxo.satoshi !== inscribedAmount)
          throw new CustomError("Invalid inscribed amount.", 400);
      } else throw new CustomError("Unsupported layer.", 400);

      const updatedList = await listRepository.update(trx, list.id, {
        status: "ACTIVE",
        vaultTxid: txid,
        vaultVout: vout,
        inscribedAmount: inscribedAmount,
      });

      const sanitizedList = hideSensitiveData(updatedList, [
        "privateKey",
        "vaultTxid",
        "vaultVout",
      ]);

      return sanitizedList;
    });
  },
  generateBuyTxHex: async (
    id: string,
    layerId: string,
    feeRate: number,
    issuerId: string
  ) => {
    const list = await listRepository.getById(id);
    if (!list) throw new CustomError("No list found.", 400);
    if (list.status !== "ACTIVE")
      throw new CustomError("This list is could not be bought.", 400);

    const seller = await userRepository.getByIdAndLayerId(
      list.sellerId,
      layerId
    );
    if (!seller) throw new CustomError("Seller not found.", 400);

    const buyer = await userRepository.getByIdAndLayerId(issuerId, layerId);
    if (!buyer) throw new CustomError("User not found.", 400);
    // if (buyer.address === seller.address)
    //   throw new CustomError("You cannot buy your own listing.", 400);

    if (list.layer === "CITREA") {
      const collectible = await collectibleRepository.getById(
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

      // Get current phase and verify purchase eligibility
      const currentPhase = await marketplaceService.getCurrentPhase(
        collection.contractAddress
      );

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
      if (currentPhase === 1) {
        // Whitelist phase
        const launch = await launchRepository.getByCollectionId(
          collectible.collectionId
        );
        if (!launch) throw new CustomError("Launch not found", 400);

        const proof = await merkleService.getMerkleProof(
          launch.id,
          buyer.address
        );
        const isWhitelisted = await merkleService.isAddressWhitelisted(
          launch.id,
          buyer.address
        );

        if (!isWhitelisted) {
          throw new CustomError("Address not whitelisted", 403);
        }
        return serializeBigInt(
          await marketplaceService.buyListingTransaction(
            parseInt(collectible.uniqueIdx.split("i")[1]),
            proof,
            list.price.toString(),
            buyer.address
          )
        );
      } else {
        // FCFS or Public phase - no merkle proof needed
        return serializeBigInt(
          await marketplaceService.buyListingTransaction(
            parseInt(collectible.uniqueIdx.split("i")[1]),
            [],
            list.price.toString(),
            buyer.address
          )
        );
      }

      // return serializeBigInt(unsignedHex);
    } else if (list.layer === "FRACTAL") {
      if (!list.inscribedAmount)
        throw new CustomError("Invalid inscribed amount.", 400);

      if (!buyer.pubkey || !list.vaultTxid || list.vaultVout === null)
        throw new CustomError("Invalid fields.", 400);

      const serviceFee = Math.min(
        list.price * LISTING_SERVICE_FEE_PERCENTAGE,
        MINIMUM_LISTING_SERVICE_FEE
      );

      const txHex = await generateBuyPsbtHex(
        {
          buyerAddress: buyer.address,
          buyerPubKey: buyer.pubkey,
          sellerAddress: seller.address,
          vaultAddress: list.address,
          vaultTxid: list.vaultTxid,
          vaultVout: list.vaultVout,
          vaultPrivateKey: list.privateKey,
          inscribedAmount: list.inscribedAmount,
          listedPrice: list.price,
          serviceFee: serviceFee,
        },
        feeRate,
        true
      );

      return txHex;
    } else throw new CustomError("Unsupported layer.", 400);
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
    layerId: string,
    hex: string,
    issuerId: string,
    txid?: string
  ) => {
    const buyer = await userRepository.getByIdAndLayerId(issuerId, layerId);
    if (!buyer) throw new CustomError("User not found.", 400);

    const list = await listRepository.getById(id);
    if (!list) throw new CustomError("No list found.", 400);
    if (list.status !== "ACTIVE")
      throw new CustomError("This list is could not be bought.", 400);

    const seller = await userRepository.getByIdAndLayerId(
      list.sellerId,
      layerId
    );
    if (!seller) throw new CustomError("Seller not found.", 400);

    return await db.transaction().execute(async (trx) => {
      if (list.layer === "CITREA") {
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
          soldAt: new Date().toISOString(),
        });
        const buyTxId = txid;
        return { txid: buyTxId, confirmedList };
      } else if (list.layer === "FRACTAL") {
        const buyTxId = await validateSignAndBroadcastBuyPsbtHex(
          hex,
          list.privateKey,
          seller.address,
          list.price
        );
        if (!buyTxId) throw new CustomError("Invalid psbt.", 400);

        const confirmedList = await listRepository.update(trx, list.id, {
          status: "SOLD",
          soldAt: new Date().toISOString(),
        });

        return { txid: buyTxId, confirmedList };
      } else throw new CustomError("Unsupported layer.", 400);
    });
  },
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
