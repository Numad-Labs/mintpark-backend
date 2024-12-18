import { ethers } from "ethers";
import { EVM_CONFIG } from "../evm-config";
import { config } from "../../../src/config/config";
import MarketplaceService from "./marketplaceService";
import { PinataSDK, PinResponse } from "pinata-web3";
import { FundingAddressService } from "./fundingAddress";
import { CustomError } from "../../../src/exceptions/CustomError";

interface UploadResult {
  metadataURI: string;
  imageMetadata: PinResponse;
  metadataFileMetadata: PinResponse;
}

class NFTService {
  provider: ethers.JsonRpcProvider;
  private marketplaceAddress: string;
  private storage: PinataSDK;
  private marketplaceService: MarketplaceService;
  private fundingService: FundingAddressService;

  constructor(
    providerUrl: string,
    marketplaceAddress: string,
    marketplaceService: MarketplaceService
  ) {
    this.provider = new ethers.JsonRpcProvider(providerUrl);
    this.marketplaceAddress = marketplaceAddress;
    this.marketplaceService = marketplaceService;

    this.storage = new PinataSDK({
      pinataJwt: config.PINATA_JWT,
      pinataGateway: config.PINATA_GATEWAY_URL,
    });
    this.fundingService = new FundingAddressService(providerUrl);
  }

  async getUnsignedDeploymentTransaction(
    initialOwner: string,
    minterAddress: string
  ) {
    const signer = await this.provider.getSigner();
    const factory = new ethers.ContractFactory(
      EVM_CONFIG.NFT_CONTRACT_ABI,
      EVM_CONFIG.NFT_CONTRACT_BYTECODE,
      signer
    );

    const unsignedTx = await factory.getDeployTransaction(
      minterAddress,
      initialOwner
    );
    return this.prepareUnsignedTransaction(unsignedTx, initialOwner);
  }

  async uploadNFTMetadata(
    file: Express.Multer.File,
    name: string
  ): Promise<string> {
    if (!file) {
      throw new CustomError("No file uploaded", 400);
    }

    try {
      // Upload image first
      const imageResponse = await this.uploadImage(file);

      // Create and upload metadata
      const metadata = {
        name: name || "Unnamed NFT",
        image: `ipfs://${imageResponse.IpfsHash}`,
      };

      const metadataResponse = await this.storage.upload.json(metadata);

      return `ipfs://${metadataResponse.IpfsHash}`;
    } catch (error) {
      throw new CustomError(`Failed to upload NFT metadata: ${error}`, 500);
    }
  }

  async mintWithInscriptionId(
    collectionAddress: string,
    recipient: string,
    inscriptionId: string
  ): Promise<string> {
    try {
      // Get the contract interface
      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.NFT_CONTRACT_ABI,
        this.provider
      );

      // Prepare the mint transaction data
      const mintData = contract.interface.encodeFunctionData("mint", [
        recipient,
        inscriptionId,
      ]);

      // Estimate the transaction fee
      const estimatedFee = await this.fundingService.estimateTransactionFee(
        collectionAddress,
        "0",
        mintData
      );

      console.log(`Estimated minting fee: ${estimatedFee.estimatedFee} ETH`);

      // Send the transaction using the funding service
      const { txHash, actualFee } =
        await this.fundingService.signAndSendTransaction(
          collectionAddress,
          "0",
          mintData
        );

      console.log(`Actual minting fee: ${actualFee} ETH`);

      // Wait for transaction confirmation
      const receipt = await this.provider.waitForTransaction(txHash, 1);

      if (!receipt) {
        throw new CustomError("Transaction failed to confirm", 500);
      }

      if (receipt.status === 0) {
        throw new CustomError("Transaction failed during execution", 500);
      }

      // Verify the mint was successful by checking for the appropriate event
      const mintEvent = receipt.logs
        .map((log) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((event) => event?.name === "InscriptionMinted");

      if (!mintEvent) {
        throw new CustomError("Mint event not found in transaction logs", 500);
      }

      return txHash;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }

      throw new CustomError(
        `Failed to mint NFT with inscription ID: ${error}`,
        500
      );
    }
  }

  async getInscriptionId(
    collectionAddress: string,
    tokenId: number
  ): Promise<string> {
    const contract = new ethers.Contract(
      collectionAddress,
      EVM_CONFIG.NFT_CONTRACT_ABI,
      this.provider
    );

    return await contract.getInscriptionId(tokenId);
  }

  private async uploadImage(file: Express.Multer.File): Promise<PinResponse> {
    try {
      const blob = new Blob([file.buffer], { type: file.mimetype });
      const fileObject = new File([blob], file.originalname, {
        type: file.mimetype,
      });

      return await this.storage.upload.file(fileObject);
    } catch (error) {
      console.error("Upload error details:", {
        error,
        file: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      });

      throw new Error(`Failed to upload file ${file.originalname}: ${error}`);
    }
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
      type: 2,
    };

    if ("to" in unsignedTx && unsignedTx.to) {
      preparedTx.to = unsignedTx.to;
    }

    return preparedTx;
  }
}

export default NFTService;
