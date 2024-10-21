import { ethers } from "ethers";
import { createThirdwebClient, defineChain, getContract } from "thirdweb";
import { ethers6Adapter } from "thirdweb/adapters/ethers6";
import { EVM_CONFIG } from "../evm-config";
import { config } from "../../../src/config/config";

class MarketplaceService {
  private marketplaceAddress: string;
  private ethersMarketplaceContract: ethers.Contract;

  constructor(marketplaceAddress: string) {
    this.marketplaceAddress = marketplaceAddress;
  }

  private async getEthersMarketplaceContract(): Promise<ethers.Contract> {
    if (!this.ethersMarketplaceContract) {
      const client = createThirdwebClient({
        secretKey: config.THIRDWEB_SECRET_KEY!,
      });

      const citreaChain = defineChain({
        id: EVM_CONFIG.CHAIN_ID,
        rpc: EVM_CONFIG.RPC_URL,
      });

      const marketplaceContract = getContract({
        address: this.marketplaceAddress,
        client,
        chain: citreaChain,
      });

      this.ethersMarketplaceContract = await ethers6Adapter.contract.toEthers({
        thirdwebContract: marketplaceContract,
      });
    }

    return this.ethersMarketplaceContract;
  }

  // Read Functions

  async DEFAULT_ADMIN_ROLE(): Promise<string> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.DEFAULT_ADMIN_ROLE();
  }

  async contractType(): Promise<string> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.contractType();
  }

  async contractURI(): Promise<string> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.contractURI();
  }

  async contractVersion(): Promise<string> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.contractVersion();
  }

  async defaultExtensions(): Promise<any> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.defaultExtensions();
  }

  async getAllExtensions(): Promise<any> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getAllExtensions();
  }

  async getExtension(extension: string): Promise<any> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getExtension(extension);
  }

  async getFlatPlatformFeeInfo(): Promise<any> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getFlatPlatformFeeInfo();
  }

  async getImplementationForFunction(
    functionSelector: string
  ): Promise<string> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getImplementationForFunction(functionSelector);
  }

  async getMetadataForFunction(functionSelector: string): Promise<any> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getMetadataForFunction(functionSelector);
  }

  async getPlatformFeeInfo(): Promise<any> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getPlatformFeeInfo();
  }

  async getPlatformFeeType(): Promise<number> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getPlatformFeeType();
  }

  async getRoleAdmin(role: string): Promise<string> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getRoleAdmin(role);
  }

  async getRoleMember(role: string, index: number): Promise<string> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getRoleMember(role, index);
  }

  async getRoleMemberCount(role: string): Promise<number> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getRoleMemberCount(role);
  }

  async getRoyaltyEngineAddress(): Promise<string> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getRoyaltyEngineAddress();
  }

  async hasRole(role: string, account: string): Promise<boolean> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.hasRole(role, account);
  }

  async hasRoleWithSwitch(role: string, account: string): Promise<boolean> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.hasRoleWithSwitch(role, account);
  }

  async isTrustedForwarder(forwarder: string): Promise<boolean> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.isTrustedForwarder(forwarder);
  }

  async supportsInterface(interfaceId: string): Promise<boolean> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.supportsInterface(interfaceId);
  }

  async currencyPriceForListing(
    listingId: number,
    currency: string
  ): Promise<ethers.BigNumber> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.currencyPriceForListing(listingId, currency);
  }

  async getAllListings(startId: number, endId: number): Promise<any> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getAllListings(startId, endId);
  }

  async getAllValidListings(startId: number, endId: number): Promise<any> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getAllValidListings(startId, endId);
  }

  async getListing(listingId: number): Promise<any> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getListing(listingId);
  }

  async isBuyerApprovedForListing(
    listingId: number,
    buyer: string
  ): Promise<boolean> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.isBuyerApprovedForListing(listingId, buyer);
  }

  async isCurrencyApprovedForListing(
    listingId: number,
    currency: string
  ): Promise<boolean> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.isCurrencyApprovedForListing(listingId, currency);
  }

  async totalListings(): Promise<number> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.totalListings();
  }

  async getAllAuctions(startId: number, endId: number): Promise<any> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getAllAuctions(startId, endId);
  }

  async getAllValidAuctions(startId: number, endId: number): Promise<any> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getAllValidAuctions(startId, endId);
  }

  async getAuction(auctionId: number): Promise<any> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getAuction(auctionId);
  }

  async getWinningBid(auctionId: number): Promise<any> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getWinningBid(auctionId);
  }

  async isAuctionExpired(auctionId: number): Promise<boolean> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.isAuctionExpired(auctionId);
  }

  async isNewWinningBid(
    auctionId: number,
    bidAmount: ethers.BigNumberish
  ): Promise<boolean> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.isNewWinningBid(auctionId, bidAmount);
  }

  async totalAuctions(): Promise<number> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.totalAuctions();
  }

  async getAllOffers(startId: number, endId: number): Promise<any> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getAllOffers(startId, endId);
  }

  async getAllValidOffers(startId: number, endId: number): Promise<any> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getAllValidOffers(startId, endId);
  }

  async getOffer(offerId: number): Promise<any> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.getOffer(offerId);
  }

  async totalOffers(): Promise<number> {
    const contract = await this.getEthersMarketplaceContract();
    return await contract.totalOffers();
  }
}

export default MarketplaceService;
