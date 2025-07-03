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

  constructor(marketplaceAddress: string, providerUrl: string) {
    this.marketplaceAddress = marketplaceAddress;
    this.provider = new ethers.JsonRpcProvider(providerUrl);
  }

  async getUnsignedDeploymentTransaction(
    initialOwner: string,
    marketplaceFee: number
  ) {
    // const signer = await this.provider.getSigner();

    const factory = new ethers.ContractFactory(
      EVM_CONFIG.MARKETPLACE_ABI,

      EVM_CONFIG.MARKETPLACE_CONTRACT_BYTECODE,
      this.provider
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

  async getListing(listingId: number) {
    const contract = await this.getEthersMarketplaceContract();
    return contract.getListing(listingId);
  }
  async getUnsignedApprovalTransaction(from: string, contractAddress: string) {
    // const { chainId } = await this.provider.getNetwork();
    // const nftContract = await this.getEthersMarketplaceContract();
    // const chainConfig = EVM_CONFIG.CHAINS[chainId.toString()];
    const nftContract = new ethers.Contract(
      contractAddress,
      EVM_CONFIG.NFT_CONTRACT_ABI,
      this.provider
    );

    // Check if the marketplace is already approved
    const isApproved = await nftContract.isApprovedForAll(
      from,
      this.marketplaceAddress
    );

    if (!isApproved) {
      const approvalTx =
        await nftContract.setApprovalForAll.populateTransaction(
          this.marketplaceAddress,
          true
        );
      const preparedApprovalTx = await this.prepareUnsignedTransaction(
        approvalTx,
        from
      );
      return {
        isApproved: false,
        transaction: preparedApprovalTx
      };
    } else {
      return {
        isApproved: true,
        transaction: null
      };
    }
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
    // console.log({
    //   givenPriceEther: price,
    //   priceInWei: priceInWei.toString()
    // });
    // Get the current counter value
    const currentCounter = await this.getNextListingId();

    // For an unsigned transaction, the expectedListingId will be currentCounter + 1
    // because the counter increments in the createListing function
    const expectedListingId = Number(currentCounter) + 1;

    return {
      transaction: await this.prepareUnsignedTransaction(
        unsignedTx,
        sellerAddress
      ),
      expectedListingId: expectedListingId.toString(),
      currentListingId: currentCounter.toString()
    };
  }

  async checkMarketplaceApproval(
    contractAddress: string,
    userAddress: string,
    chainId: string
  ): Promise<boolean> {
    const chainConfig = EVM_CONFIG.CHAINS[chainId];
    const nftContract = new ethers.Contract(
      contractAddress,
      EVM_CONFIG.NFT_CONTRACT_ABI,
      this.provider
    );

    return nftContract.isApprovedForAll(
      userAddress,
      chainConfig.MARKETPLACE_ADDRESS
    );
  }
  async buyListingTransaction(
    nftContract: string,
    tokenId: string,
    listingId: number,
    // merkleProof: string[],
    price: string,
    buyerAddress: string
  ) {
    // console.log("🚀 ~ MarketplaceService ~ price:", price);
    const contract = await this.getEthersMarketplaceContract();
    const priceInWei = ethers.parseEther(price);

    const unsignedTx = await contract.purchaseListing.populateTransaction(
      listingId,
      // merkleProof,
      { value: priceInWei }
    );
    return this.prepareUnsignedTransaction(unsignedTx, buyerAddress);
  }

  async cancelListingTransaction(
    contractAddress: string,
    tokenId: string,
    listingId: number,
    sellerAddress: string
  ) {
    const contract = await this.getEthersMarketplaceContract();

    const unsignedTx =
      await contract.cancelListing.populateTransaction(listingId);

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
