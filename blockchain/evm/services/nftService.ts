import { ethers } from "ethers";
import { EVM_CONFIG } from "../evm-config";
import { config } from "../../../src/config/config";
import MarketplaceService from "./marketplaceService";
import { PinataSDK, PinResponse } from "pinata-web3";
import { FundingAddressService } from "./fundingAddress";
import { CustomError } from "../../../src/exceptions/CustomError";
import logger from "../../../src/config/winston";
import { NextFunction, Request, Response } from "express";

class NFTService {
  provider: ethers.JsonRpcProvider;
  private marketplaceAddress: string;
  private storage: PinataSDK;
  private marketplaceService: MarketplaceService;
  private fundingService: FundingAddressService;

  constructor(
    providerUrl: string,
    marketplaceAddress: string,
    marketplaceService: MarketplaceService,
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
    minterAddress: string,
    contractName: string,
  ) {
    const signer = await this.provider.getSigner();
    const factory = new ethers.ContractFactory(
      EVM_CONFIG.INS_NFT_CONTRACT_ABI,
      EVM_CONFIG.INS_NFT_CONTRACT_BYTECODE,
      signer,
    );

    const unsignedTx = await factory.getDeployTransaction(
      minterAddress,
      initialOwner,
      contractName,
    );
    return this.prepareUnsignedTransaction(unsignedTx, initialOwner);
  }

  async uploadNFTMetadata(
    file: Express.Multer.File,
    name: string,
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
    inscriptionId: string,
    nftId: string,
  ): Promise<string> {
    try {
      // Create minter wallet
      const minterWallet = new ethers.Wallet(
        config.VAULT_PRIVATE_KEY,
        this.provider,
      );

      // Get the contract interface
      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.INS_NFT_CONTRACT_ABI,
        minterWallet, // Contract is already connected to minterWallet
      );

      // Get and verify addresses
      const contractMinterAddress = await contract.minterAddress();
      console.log(
        "Contract's authorized minter address:",
        contractMinterAddress,
      );
      console.log("Wallet address being used:", minterWallet.address);

      // Verify the wallet address matches the contract's minter address
      if (
        contractMinterAddress.toLowerCase() !==
        minterWallet.address.toLowerCase()
      ) {
        throw new CustomError(
          `Wallet address (${minterWallet.address}) does not match contract's minter address (${contractMinterAddress})`,
          400,
        );
      }

      // Mint directly using the contract instance (which is already connected to minterWallet)
      const tx = await contract.mint(recipient, nftId, inscriptionId);
      const receipt = await tx.wait();
      console.log("🚀 ~ NFTService ~ receipt:", receipt);

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
        500,
      );
    }
  }

  async mintIpfsNFTUsingVault(
    collectionAddress: string,
    recipient: string,
    nftId: string,
  ): Promise<string> {
    try {
      // Create minter wallet
      const minterWallet = new ethers.Wallet(
        config.VAULT_PRIVATE_KEY,
        this.provider,
      );

      // Get the contract interface
      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.NFT_CONTRACT_ABI,
        minterWallet, // Contract is already connected to minterWallet
      );

      // Get and verify addresses
      const contractMinterAddress = await contract.minterAddress();
      console.log(
        "Contract's authorized minter address:",
        contractMinterAddress,
      );
      console.log("Wallet address being used:", minterWallet.address);

      // Verify the wallet address matches the contract's minter address
      if (
        contractMinterAddress.toLowerCase() !==
        minterWallet.address.toLowerCase()
      ) {
        throw new CustomError(
          `Wallet address (${minterWallet.address}) does not match contract's minter address (${contractMinterAddress})`,
          400,
        );
      }

      // Mint directly using the contract instance (which is already connected to minterWallet)
      const tx = await contract.mint(recipient, nftId);
      const receipt = await tx.wait();
      console.log("🚀 ~ NFTService ~ receipt:", receipt);

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
        500,
      );
    }
  }

  async mintIpfsNFT(
    collectionAddress: string,
    recipient: string,
    nftId: string,
    ipfsCID: string,
    nftName: string,
  ) {
    try {
      const signer = await this.provider.getSigner();

      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.INS_NFT_CONTRACT_ABI,
        signer,
      );

      //todo dan zurag ireh uu esul bur name image aa aguultsan cid ireh uu?
      // // Create and upload metadata
      // const metadata = {
      //   name: nftName || "Unnamed NFT",
      //   image: `ipfs://${ipfsCID}`,
      // };

      // const metadataResponse = await this.storage.upload.json(metadata);

      const unsignedTx = await contract.safeMint.populateTransaction(
        recipient,
        nftId,
        ipfsCID,
      );

      return this.prepareUnsignedTransaction(unsignedTx, recipient);
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }

      throw new CustomError(
        `Failed to mint NFT with inscription ID: ${error}`,
        500,
      );
    }
  }

  async getInscriptionId(
    collectionAddress: string,
    tokenId: number,
  ): Promise<string> {
    const contract = new ethers.Contract(
      collectionAddress,
      EVM_CONFIG.INS_NFT_CONTRACT_ABI,
      this.provider,
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

  // async getUnsignedMintNFTTransaction(
  //   collectionAddress: string,
  //   to: string,
  //   tokenId: number,
  //   req: Request,
  // ) {
  //   const signer = await this.provider.getSigner();

  //   const contract = new ethers.Contract(
  //     collectionAddress,
  //     EVM_CONFIG.INS_NFT_CONTRACT_ABI,
  //     signer,
  //   );
  //   const metadataURI = await this.createAndUploadMetadata(req);
  //   const unsignedTx = await contract.safeMint.populateTransaction(
  //     to,
  //     tokenId,
  //     metadataURI,
  //   );

  //   return this.prepareUnsignedTransaction(unsignedTx, to);
  // }

  // private async createAndUploadMetadata(req: Request): Promise<string> {
  //   if (!req.file) {
  //     throw new Error("No file uploaded");
  //   }

  //   const blob = new Blob([file.buffer], { type: file.mimetype });
  //   const fileObject = new File([blob], file.originalname, {
  //     type: file.mimetype,
  //   });

  //   // Create metadata object
  //   const metadata = {
  //     name: req.body.name || "Unnamed NFT",
  //     description: req.body.description || "No description provided",
  //     image: imageURI, // This should be a URL pointing to the image
  //     attributes: JSON.parse(req.body.attributes || "[]"),
  //   };

  //   // Upload metadata to IPFS
  //   const metadataURI = await this.storage.upload.f(metadata, {
  //     uploadWithGatewayUrl: true,
  //   });

  //   return metadataURI;
  // }

  async prepareUnsignedTransaction(
    unsignedTx: ethers.ContractTransaction | ethers.ContractDeployTransaction,
    from: string,
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
