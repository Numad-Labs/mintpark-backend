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
  PUBLIC = 3,
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
    const signer = await this.provider.getSigner();
    return new ethers.Contract(
      this.marketplaceAddress,
      EVM_CONFIG.MARKETPLACE_ABI,
      signer
    );
  }

  // async verifyListing(listingId: number) {
  //   const signer = await this.provider.getSigner();

  //   const marketplaceFactory = new ethers.ContractFactory(
  //     EVM_CONFIG.MARKETPLACE_ABI,
  //     EVM_CONFIG.MARKETPLACE_CONTRACT_BYTECODE,
  //     signer
  //   );
  //   const listing = await marketplaceFactory.getListing(listingId);
  //   console.log("Listing status:", listing);
  //   return listing.isActive;
  // }

  async registerCollectionTransaction(
    nftContract: string,
    publicMaxMint: number,
    ownerAddress: string
  ) {
    const contract = await this.getEthersMarketplaceContract();
    const unsignedTx = await contract.registerCollection.populateTransaction(
      nftContract,
      publicMaxMint
    );
    return this.prepareUnsignedTransaction(unsignedTx, ownerAddress);
  }

  async configureOptionalPhasesTransaction(
    nftContract: string,
    whitelistEndTime: number,
    fcfsEndTime: number,
    whitelistMaxMint: number,
    fcfsMaxMint: number,
    merkleRoot: string,
    ownerAddress: string
  ) {
    const contract = await this.getEthersMarketplaceContract();
    const unsignedTx =
      await contract.configureOptionalPhases.populateTransaction(
        nftContract,
        whitelistEndTime,
        fcfsEndTime,
        whitelistMaxMint,
        fcfsMaxMint,
        merkleRoot
      );
    return this.prepareUnsignedTransaction(unsignedTx, ownerAddress);
  }

  async getCollectionConfig(nftContract: string): Promise<CollectionConfig> {
    const contract = await this.getEthersMarketplaceContract();
    return contract.getCollectionConfig(nftContract);
  }

  async getCurrentPhase(nftContract: string): Promise<Phase> {
    const contract = await this.getEthersMarketplaceContract();
    return contract.getCurrentPhase(nftContract);
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
    const unsignedTx = await contract.createListing.populateTransaction(
      nftContract,
      tokenId,
      ethers.parseEther(price)
    );
    return {
      transaction: await this.prepareUnsignedTransaction(
        unsignedTx,
        sellerAddress
      ),
      expectedListingId: (await this.getNextListingId()).toString(),
    };
  }

  async buyListingTransaction(
    listingId: number,
    merkleProof: string[],
    price: string,
    buyerAddress: string
  ) {
    console.log("🚀 ~ MarketplaceService ~ listingId:", listingId);
    const contract = await this.getEthersMarketplaceContract();
    const unsignedTx = await contract.purchaseListing.populateTransaction(
      listingId,
      merkleProof,
      {
        value: ethers.parseEther(price),
      }
    );
    return this.prepareUnsignedTransaction(unsignedTx, buyerAddress);
  }

  async cancelListingTransaction(listingId: number, sellerAddress: string) {
    const contract = await this.getEthersMarketplaceContract();
    const unsignedTx = await contract.cancelListing.populateTransaction(
      listingId
    );
    return this.prepareUnsignedTransaction(unsignedTx, sellerAddress);
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
      from: from,
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
      type: 2, // EIP-1559 transaction type
    };

    // Add 'to' property only if it exists (for non-deployment transactions)
    if ("to" in unsignedTx && unsignedTx.to) {
      preparedTx.to = unsignedTx.to;
    }

    return preparedTx;
  }
}

export default MarketplaceService;
