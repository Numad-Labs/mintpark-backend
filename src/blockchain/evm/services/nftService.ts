import { ethers } from "ethers";
import { EVM_CONFIG } from "../evm-config";
import { config } from "../../../config/config";
import { PinataSDK, PinResponse } from "pinata-web3";
import { CustomError } from "../../../exceptions/CustomError";
import { getObjectFromS3 } from "../../../utils/aws";
import logger from "../../../config/winston";
import { S3FileResponse } from "../../../types";

class NFTService {
  provider: ethers.JsonRpcProvider;
  private storage: PinataSDK;

  constructor(providerUrl: string) {
    this.provider = new ethers.JsonRpcProvider(providerUrl);

    this.storage = new PinataSDK({
      pinataJwt: config.PINATA_JWT,
      pinataGateway: config.PINATA_GATEWAY_URL
    });
  }

  async getUnsignedDeploymentTransaction(
    initialOwner: string,
    minterAddress: string,
    contractName: string,
    symbol: string,
    royaltyFee: number,
    platformFee: number,
    platformFeeRecipient: string
  ) {
    // const signer = await this.provider.getSigner();
    const factory = new ethers.ContractFactory(
      EVM_CONFIG.NFT_CONTRACT_ABI,
      EVM_CONFIG.NFT_CONTRACT_BYTECODE,
      this.provider
    );

    const unsignedTx = await factory.getDeployTransaction(
      initialOwner,
      contractName,
      symbol,
      minterAddress,
      royaltyFee,
      platformFee,
      platformFeeRecipient
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
        image: `ipfs://${imageResponse.IpfsHash}`
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
    inscriptionId: string,
    nftId: string,
    mintPrice: number
  ): Promise<string> {
    // const formattedPrice = ethers.formatEther(mintPrice);
    try {
      const minterWallet = new ethers.Wallet(
        config.VAULT_PRIVATE_KEY,
        this.provider
      );

      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.NFT_CONTRACT_ABI,
        minterWallet
      );

      const contractMinterAddress = await contract.minterAddress();

      if (
        contractMinterAddress.toLowerCase() !==
        minterWallet.address.toLowerCase()
      ) {
        throw new CustomError(
          `Wallet address (${minterWallet.address}) does not match contract's minter address (${contractMinterAddress})`,
          400
        );
      }

      const priceInWei = ethers.parseEther(mintPrice.toString());

      const tx = await contract.mint(
        recipient,
        nftId,
        inscriptionId,
        "",
        priceInWei,
        {
          value: priceInWei
        }
      );
      const receipt = await tx.wait();

      if (!receipt || receipt.status === 0) {
        throw new CustomError("Transaction failed during execution", 500);
      }

      return receipt.hash;
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

  async mintIpfsNFTUsingVault(
    collectionAddress: string,
    recipient: string,
    nftId: string,
    uri: string,
    mintPrice: number
  ): Promise<string> {
    try {
      const minterWallet = new ethers.Wallet(
        config.VAULT_PRIVATE_KEY,
        this.provider
      );

      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.NFT_CONTRACT_ABI,
        minterWallet
      );

      const contractMinterAddress = await contract.minterAddress();

      if (
        contractMinterAddress.toLowerCase() !==
        minterWallet.address.toLowerCase()
      ) {
        throw new CustomError(
          `Wallet address (${minterWallet.address}) does not match contract's minter address (${contractMinterAddress})`,
          400
        );
      }

      const priceInWei = ethers.parseEther(mintPrice.toString());

      const tx = await contract.mint(recipient, nftId, "", uri, priceInWei, {
        value: priceInWei
      });
      const receipt = await tx.wait();

      if (!receipt || receipt.status === 0) {
        throw new CustomError("Transaction failed during execution", 500);
      }

      return receipt.hash;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(`Failed to mint IPFS NFT: ${error}`, 500);
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

  async estimateMintGasFee(
    collectionAddress: string,
    recipientAddress: string,
    nftId: string,
    uri: string,
    mintPrice: number
  ) {
    try {
      const minterWallet = new ethers.Wallet(
        config.VAULT_PRIVATE_KEY,
        this.provider
      );

      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.NFT_CONTRACT_ABI,
        minterWallet
      );

      // Create an unsigned transaction to estimate gas
      const priceInWei = ethers.parseEther(mintPrice.toString());
      const unsignedTx = await contract.mint.populateTransaction(
        recipientAddress,
        nftId,
        "",
        uri,
        priceInWei,
        {
          value: priceInWei
        }
      );

      // Estimate gas
      const gasLimit = await this.provider.estimateGas({
        ...unsignedTx,
        from: minterWallet.address
      });

      // Get current gas price
      const feeData = await this.provider.getFeeData();
      const baseFee = feeData.gasPrice || ethers.parseUnits("5", "gwei");
      const maxPriorityFeePerGas = ethers.parseUnits("0.1", "gwei");
      const maxFeePerGas = baseFee + maxPriorityFeePerGas;

      // Calculate total gas cost
      const estimatedGasCost = gasLimit * maxFeePerGas;

      return {
        estimatedGasCost,
        gasLimit,
        maxFeePerGas,
        maxPriorityFeePerGas
      };
    } catch (error) {
      throw new CustomError(`Failed to estimate mint gas fee: ${error}`, 500);
    }
  }

  async generateFeeTransferTransaction(
    issuerAddress: string,
    colllectionAddress: string,
    fundingAddress: string
  ): Promise<ethers.TransactionRequest> {
    try {
      // const signer = await this.provider.getSigner();

      const nftContract = new ethers.Contract(
        colllectionAddress,
        EVM_CONFIG.NFT_CONTRACT_ABI,
        this.provider
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
        from: issuerAddress
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
        type: 2 // EIP-1559 transaction type
      };

      return unsignedTx;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(
        `Failed to generate fee transfer transaction: ${error}`,
        500
      );
    }
  }

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
}

export default NFTService;
