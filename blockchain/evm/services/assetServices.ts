// src/services/evmAssetService.ts
import { ethers } from "ethers";

import { EVM_CONFIG } from "../evm-config";

const provider = new ethers.JsonRpcProvider(EVM_CONFIG.RPC_URL);

export const evmAssetService = {
  createCollectionDeploymentTransaction: async (
    name: string,
    symbol: string,
    metadata: string
  ) => {
    const collectionFactory = new ethers.Contract(
      EVM_CONFIG.COLLECTION_FACTORY_ADDRESS,
      EVM_CONFIG.COLLECTION_FACTORY_ABI,
      provider
    );
    return await collectionFactory.getDeployTransaction(name, symbol, metadata);
  },

  createMintCollectibleTransaction: async (
    collectionAddress: string,
    tokenURI: string,
    to: string
  ) => {
    const collection = new ethers.Contract(
      collectionAddress,
      EVM_CONFIG.COLLECTION_FACTORY_ABI,
      provider
    );
    return await collection.mint.populateTransaction(to, tokenURI);
  },

  createListAssetTransaction: async (
    assetContract: string,
    tokenId: number,
    pricePerToken: string
  ) => {
    const marketplace = new ethers.Contract(
      EVM_CONFIG.MARKETPLACE_ADDRESS,
      EVM_CONFIG.MARKETPLACE_ABI,
      provider
    );
    return await marketplace.createListing.populateTransaction({
      assetContract,
      tokenId,
      startTime: Math.floor(Date.now() / 1000),
      secondsUntilEndTime: 2592000, // 30 days
      quantityToList: 1,
      currencyToAccept: ethers.constants.AddressZero, // ETH
      reservePricePerToken: pricePerToken,
      buyoutPricePerToken: pricePerToken,
      listingType: 0, // Direct listing
    });
    // return await marketplace.listAsset.populateTransaction(
    //   assetAddress,
    //   tokenId,
    //   price
    // );
  },

  createBuyAssetTransaction: async (listingId: number) => {
    const marketplace = new ethers.Contract(
      EVM_CONFIG.MARKETPLACE_ADDRESS,
      EVM_CONFIG.MARKETPLACE_ABI,
      provider
    );
    return await marketplace.buyAsset.populateTransaction(listingId);
  },
};
