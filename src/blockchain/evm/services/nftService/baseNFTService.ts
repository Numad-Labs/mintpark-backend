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
  async prepareUnsignedTransaction(
    unsignedTx: ethers.ContractTransaction | ethers.ContractDeployTransaction,
    from: string
  ) {
    const { chainId } = await this.provider.getNetwork();
    const chainConfig = EVM_CONFIG.CHAINS[chainId.toString()];

    const estimatedGas = await this.provider.estimateGas({
      ...unsignedTx,
      from: from
    });

    // Base transaction fields
    const baseTx: Partial<ethers.TransactionRequest> = {
      from: from,
      data: unsignedTx.data,
      value: unsignedTx.value || "0x0",
      gasLimit: estimatedGas,
      nonce: await this.provider.getTransactionCount(from),
      chainId: chainId
    };

    // Get fee data for both legacy and EIP-1559 transactions
    const feeData = await this.provider.getFeeData();
    const multiplier = chainConfig?.gasPriceMultiplier || 1;

    // Handle chain-specific gas pricing
    if (chainConfig?.useLegacyGas) {
      // Legacy transaction (e.g., for some L2s)
      // Use gasPrice from feeData for legacy transactions
      if (!feeData.gasPrice) {
        throw new Error("Unable to get gas price for legacy transaction");
      }

      return {
        ...baseTx,
        gasPrice:
          (feeData.gasPrice * BigInt(Math.floor(multiplier * 100))) /
          BigInt(100),
        type: 0
      };
    } else {
      // EIP-1559 transaction
      if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
        throw new Error("Unable to get EIP-1559 fee data");
      }

      return {
        ...baseTx,
        maxFeePerGas:
          (feeData.maxFeePerGas * BigInt(Math.floor(multiplier * 100))) /
          BigInt(100),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        type: 2
      };
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
