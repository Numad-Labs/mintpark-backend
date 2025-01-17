import { ethers } from "ethers";
import { EVM_CONFIG } from "../evm-config";

interface CollectionConfig {
  isActive: boolean;
  publicMaxMint: number;
  whitelistEndTime: number;
  fcfsEndTime: number;
  whitelistMaxMint: number;
  fcfsMaxMint: number;
  merkleRoot: string;
}

enum Phase {
  INACTIVE = 0,
  WHITELIST = 1,
  FCFS = 2,
  PUBLIC = 3
}

class MarketplaceService {
  private marketplaceAddress: string;
  private provider: ethers.JsonRpcProvider;

  constructor(marketplaceAddress: string) {
    this.marketplaceAddress = marketplaceAddress;
    this.provider = new ethers.JsonRpcProvider(EVM_CONFIG.RPC_URL);
  }

  async getUnsignedDeploymentTransaction(
    initialOwner: string,
    marketplaceFee: number
  ) {
    const signer = await this.provider.getSigner();

    const factory = new ethers.ContractFactory(
      EVM_CONFIG.MARKETPLACE_ABI,
      EVM_CONFIG.MARKETPLACE_CONTRACT_BYTECODE,
      signer
    );

    const unsignedTx = await factory.getDeployTransaction(
      initialOwner,
      marketplaceFee
    );
    return this.prepareUnsignedTransaction(unsignedTx, initialOwner);
  }

  async getEthersMarketplaceContract() {
    // const signer = await this.provider.getSigner();
    return new ethers.Contract(
      this.marketplaceAddress,
      EVM_CONFIG.MARKETPLACE_ABI,
      this.provider
    );
  }

  async getListing(nftContract: string, tokenId: string) {
    const contract = await this.getEthersMarketplaceContract();
    return contract.getListing(nftContract, tokenId);
  }

  async createListingTransaction(
    nftContract: string,
    tokenId: string,
    price: string,
    sellerAddress: string
  ) {
    const contract = await this.getEthersMarketplaceContract();
    const priceInWei = ethers.parseEther(price);
    const unsignedTx = await contract.createListing.populateTransaction(
      nftContract,
      tokenId,
      priceInWei
    );
    console.log({
      givenPriceEther: price,
      priceInWei: priceInWei.toString()
    });
    const nextListingId = await this.getNextListingId();
    console.log("🚀 ~ MarketplaceService ~ nextListingId:", nextListingId);

    // The current listing ID will be one less than the counter
    const currentListingId =
      Number(nextListingId) > 0 ? Number(nextListingId) - 1 : 0;

    return {
      transaction: await this.prepareUnsignedTransaction(
        unsignedTx,
        sellerAddress
      ),
      expectedListingId: (await this.getNextListingId()).toString(),
      currentListingId: currentListingId.toString()
    };
  }

  async buyListingTransaction(
    nftContract: string,
    tokenId: string,
    listingId: number,
    // merkleProof: string[],
    price: string,
    buyerAddress: string
  ) {
    console.log("🚀 ~ MarketplaceService ~ price:", price);
    const contract = await this.getEthersMarketplaceContract();

    console.log("🚀 ~ MarketplaceService ~ listingId:", listingId);

    // Get all listings
    const allListings = await this.getAllListings();
    console.log("🚀 ~ MarketplaceService ~ allListings:", allListings);

    // Find active listing with matching contract and token ID
    // Sort by listingId in descending order to get the most recent listing
    const matchingListings = allListings
      .filter(
        (listing) =>
          listing.nftContract.toLowerCase() === nftContract.toLowerCase() &&
          listing.tokenId === parseInt(tokenId) &&
          listing.isActive === true
      )
      .sort((a, b) => b.listingId - a.listingId);

    if (matchingListings.length === 0) {
      throw new Error("No active listing found for this NFT");
    }

    // Get the most recent active listing
    const targetListing = matchingListings[0];
    if (!targetListing.isActive) {
      throw new Error("Listing is not active");
    }
    const priceInWei = ethers.parseEther(price);

    // Compare prices in Wei format
    if (targetListing.price.toString() !== priceInWei.toString()) {
      throw new Error(
        `Price mismatch. Expected: ${ethers.formatEther(targetListing.price)}, Got: ${price}`
      );
    }

    console.log("Found listing:", {
      listingId: targetListing.listingId,
      price: priceInWei,
      tokenId: targetListing.tokenId,
      nftContract: targetListing.nftContract
    });

    console.log(
      "🚀 ~ MarketplaceService ~ targetListing.price:",
      targetListing.price
    );
    const unsignedTx = await contract.purchaseListing.populateTransaction(
      targetListing.listingId,
      // merkleProof,
      { value: priceInWei }
    );
    return this.prepareUnsignedTransaction(unsignedTx, buyerAddress);
  }

  async cancelListingTransaction(
    contractAddress: string,
    tokenId: string,
    sellerAddress: string
  ) {
    const contract = await this.getEthersMarketplaceContract();

    // Get all listings
    const allListings = await this.getAllListings();
    console.log("🚀 ~ MarketplaceService ~ allListings:", allListings);

    // Find active listing with matching contract and token ID
    // Sort by listingId in descending order to get the most recent listing
    const matchingListings = allListings
      .filter(
        (listing) =>
          listing.nftContract.toLowerCase() === contractAddress.toLowerCase() &&
          listing.tokenId === parseInt(tokenId) &&
          listing.isActive === true
      )
      .sort((a, b) => b.listingId - a.listingId);

    if (matchingListings.length === 0) {
      throw new Error("No active listing found for this NFT");
    }

    // Get the most recent active listing
    const targetListing = matchingListings[0];
    if (!targetListing.isActive) {
      throw new Error("Listing is not active");
    }
    const unsignedTx = await contract.cancelListing.populateTransaction(
      targetListing.listingId
    );

    return this.prepareUnsignedTransaction(unsignedTx, sellerAddress);
  }

  async getAllListings() {
    const contract = await this.getEthersMarketplaceContract();
    const listingCounter = await this.getNextListingId();
    const listings = [];

    // Fetch all listings from 1 to listingCounter
    for (let i = 1; i <= listingCounter; i++) {
      try {
        const listing = await contract.getListing(i);
        listings.push({
          listingId: i,
          nftContract: listing.nftContract,
          tokenId: Number(listing.tokenId),
          seller: listing.seller,
          price: listing.price,
          isActive: listing.isActive
        });
      } catch (error) {
        console.warn(`Failed to fetch listing ${i}:`, error);
      }
    }

    return listings;
  }

  // Add this method to get the next listing ID
  private async getNextListingId(): Promise<number> {
    const contract = await this.getEthersMarketplaceContract();
    // You'll need to add a view function in your contract to get this
    return contract.getListingIdCounter();
  }
  async prepareUnsignedTransaction(
    unsignedTx: ethers.ContractTransaction | ethers.ContractDeployTransaction,
    from: string
  ) {
    const estimatedGas = await this.provider.estimateGas({
      ...unsignedTx,
      from: from
    });
    const feeData = await this.provider.getFeeData();
    const nonce = await this.provider.getTransactionCount(from);
    const { chainId } = await this.provider.getNetwork();

    const preparedTx: ethers.TransactionRequest = {
      from: from,
      data: unsignedTx.data,
      value: unsignedTx.value || "0x0",
      gasLimit: estimatedGas,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      nonce: nonce,
      chainId: chainId,
      type: 2 // EIP-1559 transaction type
    };

    // Add 'to' property only if it exists (for non-deployment transactions)
    if ("to" in unsignedTx && unsignedTx.to) {
      preparedTx.to = unsignedTx.to;
    }

    return preparedTx;
  }
}

export default MarketplaceService;
