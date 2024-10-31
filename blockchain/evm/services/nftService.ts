import { ethers } from "ethers";
import { EVM_CONFIG } from "../evm-config";
import { config } from "../../../src/config/config";
import { NextFunction, Request, Response } from "express";
import MarketplaceService from "./marketplaceService";

import { PinataSDK, PinResponse } from "pinata-web3";
import { convertMulterToFileObject } from "../utils";

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
  }

  async getUnsignedDeploymentTransaction(
    initialOwner: string,
    name: string,
    symbol: string,
    priceForLaunchpad: number
  ) {
    const signer = await this.provider.getSigner();
    const factory = new ethers.ContractFactory(
      EVM_CONFIG.NFT_CONTRACT_ABI,
      EVM_CONFIG.NFT_CONTRACT_BYTECODE,
      signer
    );

    const unsignedTx = await factory.getDeployTransaction(
      initialOwner,
      name,
      symbol,
      ethers.parseEther(priceForLaunchpad.toString()) // mintFee
    );
    return this.prepareUnsignedTransaction(unsignedTx, initialOwner);
  }

  async getUnsignedMintNFTTransaction(
    collectionAddress: string,
    to: string,
    name: string,
    quantity: number,
    files: Express.Multer.File[]
  ) {
    const signer = await this.provider.getSigner();

    const contract = new ethers.Contract(
      collectionAddress,
      EVM_CONFIG.NFT_CONTRACT_ABI,
      signer
    );
    const metadataURIs = await this.createAndUploadBatchMetadata(
      files,
      quantity,
      name
    );

    // Assuming the contract has a batchMintWithURI function
    const unsignedTx = await contract.batchMint.populateTransaction(
      to,
      quantity,
      metadataURIs
    );
    return this.prepareUnsignedTransaction(unsignedTx, to);
  }

  async uploadNftImagesToIpfs(
    name: string,
    quantity: number,
    files: Express.Multer.File[]
  ) {
    // Handle file uploads and metadata creation
    const metadataURIs = await this.createAndUploadBatchMetadata(
      files,
      quantity,
      name
    );

    return metadataURIs;
  }

  async getUnsignedBatchMintNFTTransaction(
    collectionAddress: string,
    to: string,
    quantity: number,
    metadataURIs: string[]
  ) {
    const signer = await this.provider.getSigner();

    const contract = new ethers.Contract(
      collectionAddress,
      EVM_CONFIG.NFT_CONTRACT_ABI,
      signer
    );

    // Assuming the contract has a batchMintWithURI function
    const unsignedTx = await contract.batchMint.populateTransaction(
      to,
      // startTokenId,
      quantity,
      metadataURIs
    );

    return this.prepareUnsignedTransaction(unsignedTx, to);
  }

  // async getUnsignedMintNFTTransaction(
  //   collectionAddress: string,
  //   to: string,
  //   quantity: number,
  //   metadataURIs: string[]
  // ) {
  //   const signer = await this.provider.getSigner();

  //   const contract = new ethers.Contract(
  //     collectionAddress,
  //     EVM_CONFIG.NFT_CONTRACT_ABI,
  //     signer
  //   );

  //   // Handle file uploads and metadata creation
  //   const metadataURIs = await this.createAndUploadBatchMetadata(
  //     files,
  //     quantity,
  //     name
  //   );

  //   // Assuming the contract has a batchMintWithURI function
  //   const unsignedTx = await contract.batchMint.populateTransaction(
  //     to,
  //     // startTokenId,
  //     quantity,
  //     metadataURIs
  //   );

  //   return this.prepareUnsignedTransaction(unsignedTx, to);
  // }

  async getUnsignedListNFTTransaction(
    collectionAddress: string,
    tokenId: string,
    pricePerToken: string,
    from: string
  ) {
    try {
      const signer = await this.provider.getSigner();

      const nftContract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.NFT_CONTRACT_ABI,
        signer
      );

      // Check if the marketplace is already approved
      const isApproved = await nftContract.isApprovedForAll(
        from,
        this.marketplaceAddress
      );
      console.log("🚀 ~ NFTService ~ isApproved:", isApproved);

      if (!isApproved) {
        console.log("Approval needed. Preparing approval transaction...");
        const approvalTx =
          await nftContract.setApprovalForAll.populateTransaction(
            this.marketplaceAddress,
            true
          );
        const preparedApprovalTx = await this.prepareUnsignedTransaction(
          approvalTx,
          from
        );

        // Return the approval transaction instead of the listing transaction
        return {
          type: "approval",
          transaction: preparedApprovalTx,
        };
      }

      console.log(
        "NFT already approved or approval transaction sent. Preparing listing transaction..."
      );

      const listing = {
        assetContract: collectionAddress,
        tokenId: tokenId,
        startTime: Math.floor(Date.now() / 1000),
        startTimestamp: Math.floor(Date.now() / 1000),
        endTimestamp: Math.floor(Date.now() / 1000) + 86400 * 7, // 1 week
        listingDurationInSeconds: 86400 * 7, // 1 week
        quantity: 1,
        currency: ethers.ZeroAddress, // ETH
        reservePricePerToken: pricePerToken,
        buyoutPricePerToken: pricePerToken,
        listingType: 0, // Direct listing
        pricePerToken: pricePerToken,
        reserved: false,
      };

      const marketplaceContract =
        await this.marketplaceService.getEthersMarketplaceContract();
      if (!marketplaceContract) {
        throw new Error("Could not find marketplace contract");
      }

      const testing = await marketplaceContract.contractType();
      console.log("🚀 ~ NFTService ~ testing:", testing);
      console.log(
        "🚀 ~ NFTService ~ marketplaceContract:",
        marketplaceContract
      );
      const unsignedTx =
        await marketplaceContract.createListing.populateTransaction(listing);

      if (!unsignedTx) {
        throw new Error("Failed to populate transaction for createListing");
      }

      // Combine transactions using multicall

      const multicallTx =
        await marketplaceContract.multicall.populateTransaction([
          unsignedTx.data,
        ]);

      const preparedListingTx = await this.prepareUnsignedTransaction(
        multicallTx,
        from
      );

      console.log("🚀 ~ NFTService ~ preparedListingTx:", preparedListingTx);

      return {
        type: "listing",
        transaction: preparedListingTx,
      };
    } catch (error) {
      console.error("Error in getUnsignedListNFTTransaction:", error);
      throw error;
    }
  }

  async uploadImages(
    files: Express.Multer.File[]
    // storage: { upload: { file: (file: File) => Promise<PinResponse> } }
  ): Promise<PinResponse[]> {
    const createUploadTask = async (file: Express.Multer.File) => {
      try {
        const blob = new Blob([file.buffer], { type: file.mimetype });
        const fileObject = new File([blob], file.originalname, {
          type: file.mimetype,
        });

        return this.storage.upload.file(fileObject);
      } catch (error) {
        console.error("Upload error details:", {
          error,
          file: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        });

        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        throw new Error(
          `Failed to upload file ${file.originalname}: ${errorMessage}`
        );
      }
    };

    // Create an array of upload promises
    const uploadPromises = files.map((file) => createUploadTask(file));

    // Process uploads concurrently with error handling
    try {
      const responses = await Promise.all(uploadPromises);
      return responses;
    } catch (error) {
      // If any upload fails, the error will be caught here
      throw error;
    }
  }

  async createAndUploadBatchMetadata(
    files: Express.Multer.File[],
    quantity: number,
    name: string
  ): Promise<string[]> {
    console.log("Files received:", files ? files.length : 0);
    console.log("Expected quantity:", quantity);

    if (!files || !Array.isArray(files)) {
      throw new Error("No files uploaded or files are not in expected format");
    }

    const imageUploadResponses: PinResponse[] = await this.uploadImages(files);
    // for (const file of files) {
    //   try {
    //     const blob = new Blob([file.buffer], { type: file.mimetype });
    //     const fileObject = new File([blob], file.originalname, {
    //       type: file.mimetype,
    //     });

    //     const response: PinResponse = await this.storage.upload.file(
    //       fileObject
    //     );
    //     imageUploadResponses.push(response);
    //   } catch (error) {
    //     console.error("Upload error details:", {
    //       error,
    //       file: file.originalname,
    //       mimetype: file.mimetype,
    //       size: file.size,
    //     });

    //     const errorMessage =
    //       error instanceof Error ? error.message : "Unknown error occurred";

    //     throw new Error(
    //       `Failed to upload file ${file.originalname}: ${errorMessage}`
    //     );
    //   }
    // }

    // Create metadata objects for all NFTs using the IPFS hashes from the image uploads
    const metadataObjects = imageUploadResponses.map(
      (imageResponse, index) => ({
        name: `${name || "Unnamed NFT"} #${index + 1}`,
        image: `ipfs://${imageResponse.IpfsHash}`, // Using IPFS URI format
      })
    );

    // Upload metadata files one by one
    const metadataUploadResponses: PinResponse[] = [];
    for (const metadata of metadataObjects) {
      const response: PinResponse = await this.storage.upload.json(metadata);
      metadataUploadResponses.push(response);
    }
    // Combine all the metadata into a single return object for each NFT
    const results: UploadResult[] = metadataUploadResponses.map(
      (metadataResponse, index) => ({
        metadataURI: `ipfs://${metadataResponse.IpfsHash}`,
        imageMetadata: imageUploadResponses[index],
        metadataFileMetadata: metadataResponse,
      })
    );

    return results.map((result) => result.metadataURI);
  }

  private async createAndUploadMetadata(req: Request): Promise<string> {
    if (!req.file) {
      throw new Error("No file uploaded");
    }

    // Upload the image to IPFS
    const imageFile = req.file;
    const imageURI = await this.storage.upload.file(
      convertMulterToFileObject(imageFile)
    );

    // Create metadata object
    const metadata = {
      name: req.body.name || "Unnamed NFT",
      description: req.body.description || "No description provided",
      image: imageURI, // This should be a URL pointing to the image
      attributes: JSON.parse(req.body.attributes || "[]"),
    };

    // Upload metadata to IPFS
    const metadataURI = await this.storage.upload.json(metadata);

    return `ipfs://${metadataURI.IpfsHash}`;
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

export default NFTService;
