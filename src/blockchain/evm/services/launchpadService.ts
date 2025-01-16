import { ethers } from "ethers";
import { EVM_CONFIG } from "../evm-config";
import MarketplaceService from "./marketplaceService";
import NFTService from "./nftService";
import { Collectible, DB, Launch, LaunchItem } from "../../../types/db/types";
import { CustomError } from "../../../exceptions/CustomError";
import { PinataSDK, PinResponse } from "pinata-web3";
import { config } from "../../../config/config";
import { Insertable } from "kysely";

const nftService = new NFTService(EVM_CONFIG.RPC_URL);

class LaunchpadService {
  private provider: ethers.JsonRpcProvider;
  private storage: PinataSDK;

  constructor(providerUrl: string, marketplaceService: MarketplaceService) {
    this.provider = new ethers.JsonRpcProvider(providerUrl);

    this.storage = new PinataSDK({
      pinataJwt: config.PINATA_JWT,
      pinataGateway: config.PINATA_GATEWAY_URL,
    });
  }
  async getUnsignedLaunchMintTransaction(
    pickedCollectible: Insertable<Collectible>,
    buyer: string,
    collectionAddress: string,
    mintPrice: number,
  ) {
    if (!pickedCollectible.cid || !pickedCollectible.uniqueIdx) {
      throw new CustomError(
        "Collectible with invalid cid or unique index.",
        400,
      );
    }

    const tokenId = pickedCollectible.uniqueIdx.split("i")[1];

    // const mintPrice = await this.nftService.getMintPrice(collectionAddress);

    return await nftService.mintIpfsNFTUsingVault(
      collectionAddress,
      buyer,
      tokenId,
      pickedCollectible.cid,
      mintPrice,
    );
  }

  async generateMetadataFromCid(name: string, cid: string) {
    // Create metadata object
    const metadata = {
      name: name || "Unnamed NFT",
      image: `ipfs://${cid}`,
    };

    // Upload metadata to IPFS
    const metadataResponse: PinResponse =
      await this.storage.upload.json(metadata);

    return `ipfs://${metadataResponse.IpfsHash}`;
  }

  async generateFeeTransferTransaction(
    issuerAddress: string,
    colllectionAddress: string,
    fundingAddress: string,
  ): Promise<ethers.TransactionRequest> {
    try {
      const signer = await this.provider.getSigner();

      const nftContract = new ethers.Contract(
        colllectionAddress,
        EVM_CONFIG.NFT_CONTRACT_ABI,
        signer,
      );
      // Calculate the required fees
      const mintFee = await nftContract.mintFee();

      if (mintFee <= 0) {
        throw new CustomError("Total fee amount must be greater than 0", 400);
      }

      // Verify funding address
      if (!ethers.isAddress(fundingAddress)) {
        throw new CustomError("Invalid funding address", 400);
      }

      // Create the basic transaction object
      const transactionRequest: ethers.TransactionRequest = {
        to: fundingAddress,
        value: ethers.parseEther(mintFee.toString()),
        from: issuerAddress,
      };

      // Get the provider's network info
      const network = await this.provider.getNetwork();
      const feeData = await this.provider.getFeeData();
      const nonce = await this.provider.getTransactionCount(issuerAddress);

      // Estimate gas for the transfer
      const gasLimit = await this.provider.estimateGas(transactionRequest);

      // Prepare the complete unsigned transaction
      const unsignedTx: ethers.TransactionRequest = {
        ...transactionRequest,
        chainId: network.chainId,
        nonce: nonce,
        gasLimit: gasLimit,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        type: 2, // EIP-1559 transaction type
      };

      return unsignedTx;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(
        `Failed to generate fee transfer transaction: ${error}`,
        500,
      );
    }
  }
}

export default LaunchpadService;
