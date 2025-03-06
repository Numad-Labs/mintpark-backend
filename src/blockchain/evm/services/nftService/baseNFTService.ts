import { ethers } from "ethers";
import { PinataSDK } from "pinata-web3";
import { config } from "../../../../config/config";
import { EVM_CONFIG } from "../../evm-config";
import { CustomError } from "../../../../exceptions/CustomError";
import { getObjectFromS3 } from "../../../../utils/aws";
import { PinResponse, S3FileResponse } from "../../../../types";

// BaseNFTService.ts - Common functionality shared between services
export class BaseNFTService {
  protected provider: ethers.JsonRpcProvider;
  protected storage: PinataSDK;

  constructor(providerUrl: string) {
    this.provider = new ethers.JsonRpcProvider(providerUrl);
    this.storage = new PinataSDK({
      pinataJwt: config.PINATA_JWT,
      pinataGateway: config.PINATA_GATEWAY_URL
    });
  }

  // Common methods like IPFS uploads, transaction preparation etc
  protected async prepareUnsignedTransaction(
    unsignedTx: ethers.ContractTransaction | ethers.ContractDeployTransaction,
    from: string
  ) {
    const { chainId } = await this.provider.getNetwork();
    const chainConfig = EVM_CONFIG.CHAINS[chainId.toString()];

    if (!chainConfig) {
      throw new Error(`Chain configuration not found for chainId: ${chainId}`);
    }

    const estimatedGas = await this.provider.estimateGas({
      ...unsignedTx,
      from: from
    });

    // Add 20% buffer to estimated gas
    const gasLimit = (estimatedGas * BigInt(110)) / BigInt(100);

    const baseTx: Partial<ethers.TransactionRequest> = {
      from: from,
      data: unsignedTx.data,
      value: unsignedTx.value || "0x0",

      // gasLimit: gasLimit,
      nonce: await this.provider.getTransactionCount(from),
      chainId: chainId
    };

    // Add 'to' address only if it's a ContractTransaction
    if ("to" in unsignedTx && unsignedTx.to) {
      baseTx.to = unsignedTx.to;
    }

    const feeData = await this.provider.getFeeData();
    const multiplier = chainConfig.gasPriceMultiplier || 1;

    if (chainConfig.useLegacyGas) {
      // Legacy transaction (type 0)
      if (!feeData.gasPrice) {
        throw new Error("Unable to get gas price for legacy transaction");
      }

      // For Hemi chain, adjust gas price with multiplier
      let adjustedGasPrice = feeData.gasPrice;
      if (multiplier !== 1) {
        adjustedGasPrice =
          (adjustedGasPrice * BigInt(Math.floor(multiplier * 100))) /
          BigInt(100);
      }

      return {
        ...baseTx,
        gasPrice: adjustedGasPrice,
        type: 0
      };
    } else {
      // EIP-1559 transaction (type 2)
      if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
        // Fallback to legacy gas price if EIP-1559 fees are not available
        if (feeData.gasPrice) {
          return {
            ...baseTx,
            gasPrice: feeData.gasPrice,
            type: 0
          };
        }
        throw new Error("Unable to get fee data");
      }

      let adjustedMaxFeePerGas = feeData.maxFeePerGas;
      if (multiplier !== 1) {
        adjustedMaxFeePerGas =
          (adjustedMaxFeePerGas * BigInt(Math.floor(multiplier * 100))) /
          BigInt(100);
      }

      return {
        ...baseTx,
        maxFeePerGas: adjustedMaxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        type: 2
      };
    }
  }

  async isNFTMinted(
    collectionAddress: string,
    tokenId: string
  ): Promise<boolean> {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.NFT_CONTRACT_ABI,
        this.provider
      );

      // Try to get the owner of the token
      // If the token doesn't exist (not minted), this will throw an error
      const owner = await contract.ownerOf(tokenId);
      // console.log("🚀 ~ BaseNFTService ~ owner:", owner);

      // If we get here, the token exists and is minted
      return true;
    } catch (error) {
      // If the error is because the token doesn't exist, return false
      // Otherwise, propagate the error
      if (
        error instanceof Error &&
        error.message.includes("ERC721NonexistentToken(uint256)")
      ) {
        return false;
      }
      throw new CustomError(`Failed to check NFT minted status: ${error}`, 500);
    }
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
        image: `ipfs://${imageResponse.IpfsHash}`
      };

      const metadataResponse = await this.storage.upload.json(metadata);

      return `ipfs://${metadataResponse.IpfsHash}`;
    } catch (error) {
      throw new CustomError(`Failed to upload NFT metadata: ${error}`, 500);
    }
  }
  private async uploadImage(file: Express.Multer.File): Promise<PinResponse> {
    try {
      const blob = new Blob([file.buffer], { type: file.mimetype });
      const fileObject = new File([blob], file.originalname, {
        type: file.mimetype
      });
      // this.storage.

      return await this.storage.upload.file(fileObject);
    } catch (error) {
      console.error("Upload error details:", {
        error,
        file: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      });

      throw new Error(`Failed to upload file ${file.originalname}: ${error}`);
    }
  }

  async uploadS3FileToIpfs(fileKey: string, name: string): Promise<string> {
    try {
      // Get file from S3 - returns base64 content
      const s3File = (await getObjectFromS3(fileKey)) as S3FileResponse;

      if (typeof s3File.content !== "string") {
        throw new CustomError("Invalid S3 file content format", 400);
      }

      // Convert base64 to buffer with type safety
      const buffer = Buffer.from(s3File.content, "base64");

      // Convert S3 file to Express-like Multer file format
      const multerFile: Express.Multer.File = {
        buffer: buffer,
        originalname: name,
        mimetype: s3File.contentType || "application/octet-stream",
        size: s3File.contentLength || buffer.length,
        fieldname: "file",
        encoding: "7bit",
        destination: "",
        filename: "",
        path: "",
        stream: null as any
      };

      // Upload to IPFS using existing method
      return await this.uploadNFTMetadata(multerFile, name);
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(`Failed to upload S3 file to IPFS: ${error}`, 500);
    }
  }
}
