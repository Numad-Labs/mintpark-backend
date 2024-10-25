import { ethers } from "ethers";
import { EVM_CONFIG } from "../evm-config";
import NFTService from "./nftService";

class MarketplaceService {
  private marketplaceAddress: string;
  private provider: ethers.JsonRpcProvider;

  constructor(marketplaceAddress: string) {
    this.marketplaceAddress = marketplaceAddress;
    this.provider = new ethers.JsonRpcProvider(EVM_CONFIG.RPC_URL);
  }

  async getUnsignedDeploymentTransaction(initialOwner: string) {
    const signer = await this.provider.getSigner();

    const factory = new ethers.ContractFactory(
      EVM_CONFIG.MARKETPLACE_ABI,
      EVM_CONFIG.MARKETPLACE_CONTRACT_BYTECODE,
      signer
    );

    const unsignedTx = await factory.getDeployTransaction();

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
    const unsignedTx = await contract.listItem.populateTransaction(
      nftContract,
      tokenId,
      ethers.parseEther(price)
    );
    return this.prepareUnsignedTransaction(unsignedTx, sellerAddress);
  }

  async buyListingTransaction(
    nftContract: string,
    tokenId: string,
    price: string,
    buyerAddress: string
  ) {
    const contract = await this.getEthersMarketplaceContract();
    const unsignedTx = await contract.buyItem.populateTransaction(
      nftContract,
      tokenId,
      {
        value: ethers.parseEther(price),
      }
    );
    return this.prepareUnsignedTransaction(unsignedTx, buyerAddress);
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
