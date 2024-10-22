import { ethers } from "ethers";
import { EVM_CONFIG } from "../evm-config";
import { ethers6Adapter } from "thirdweb/adapters/ethers6";
import { createThirdwebClient, defineChain, getContract } from "thirdweb";
import { config } from "../../../src/config/config";
import { ThirdwebStorage } from "@thirdweb-dev/storage";
import { NextFunction, Request, Response } from "express";
import MarketplaceService from "./marketplaceService";

class NFTService {
  private provider: ethers.JsonRpcProvider;
  private marketplaceAddress: string;
  private storage: ThirdwebStorage;
  private marketplaceService: MarketplaceService;

  constructor(
    providerUrl: string,
    marketplaceAddress: string,
    marketplaceService: MarketplaceService
  ) {
    this.provider = new ethers.JsonRpcProvider(providerUrl);
    this.marketplaceAddress = marketplaceAddress;
    this.marketplaceService = marketplaceService;

    this.storage = new ThirdwebStorage({
      secretKey: config.THIRDWEB_SECRET_KEY,
    });
  }

  async getUnsignedDeploymentTransaction(
    initialOwner: string,
    name: string,
    symbol: string
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
      symbol
    );
    return this.prepareUnsignedTransaction(unsignedTx, initialOwner);
  }

  async getUnsignedMintNFTTransaction(
    collectionAddress: string,
    to: string,
    tokenId: number,
    req: Request
  ) {
    const signer = await this.provider.getSigner();

    const contract = new ethers.Contract(
      collectionAddress,
      EVM_CONFIG.NFT_CONTRACT_ABI,
      signer
    );
    const metadataURI = await this.createAndUploadMetadata(req);
    const unsignedTx = await contract.safeMint.populateTransaction(
      to,
      tokenId,
      metadataURI
    );

    return this.prepareUnsignedTransaction(unsignedTx, to);
  }

  async getUnsignedBatchMintNFTTransaction(
    collectionAddress: string,
    to: string,
    startTokenId: number,
    quantity: number,
    req: Request
  ) {
    const signer = await this.provider.getSigner();

    const contract = new ethers.Contract(
      collectionAddress,
      EVM_CONFIG.NFT_CONTRACT_ABI,
      signer
    );

    // Handle file uploads and metadata creation
    const metadataURIs = await this.createAndUploadBatchMetadata(req, quantity);

    // Assuming the contract has a batchMintWithURI function
    const unsignedTx = await contract.batchMint.populateTransaction(
      to,
      // startTokenId,
      quantity,
      metadataURIs
    );

    return this.prepareUnsignedTransaction(unsignedTx, to);
  }

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

  private async createAndUploadBatchMetadata(
    req: Request,
    quantity: number
  ): Promise<string[]> {
    // Check if files exist in the request
    const files = req.files as Express.Multer.File[] | undefined;

    console.log("Files received:", files ? files.length : 0);
    console.log("Expected quantity:", quantity);

    if (!files || !Array.isArray(files)) {
      throw new Error("No files uploaded or files are not in expected format");
    }

    // if (files.length !== quantity) {
    //   throw new Error(
    //     `Expected ${quantity} files, but received ${files.length}`
    //   );
    // }

    const metadataURIs = await Promise.all(
      files.map(async (file, index) => {
        // Upload the image to IPFS
        const imageURI = await this.storage.upload(file.buffer, {
          uploadWithGatewayUrl: true,
        });

        // Create metadata object
        const metadata = {
          name: `${req.body.name || "Unnamed NFT"} #${index + 1}`,
          description: req.body.description || "No description provided",
          image: imageURI,
          attributes: JSON.parse(req.body.attributes || "[]"),
        };

        // Upload metadata to IPFS
        const metadataURI = await this.storage.upload(metadata, {
          uploadWithGatewayUrl: true,
        });

        return metadataURI;
      })
    );

    return metadataURIs;
  }

  private async createAndUploadMetadata(req: Request): Promise<string> {
    if (!req.file) {
      throw new Error("No file uploaded");
    }

    // Upload the image to IPFS
    const imageFile = req.file;
    const imageURI = await this.storage.upload(imageFile.buffer, {
      uploadWithGatewayUrl: true,
    });

    // Create metadata object
    const metadata = {
      name: req.body.name || "Unnamed NFT",
      description: req.body.description || "No description provided",
      image: imageURI, // This should be a URL pointing to the image
      attributes: JSON.parse(req.body.attributes || "[]"),
    };

    // Upload metadata to IPFS
    const metadataURI = await this.storage.upload(metadata, {
      uploadWithGatewayUrl: true,
    });

    return metadataURI;
  }

  async createLaunchpadListing(
    collectionAddress: string,
    launchData: {
      price: string;
      startTime: number;
      endTime: number;
      maxPerWallet: number;
      totalSupply: number;
    },
    ownerAddress: string
  ) {
    try {
      const listing = {
        assetContract: collectionAddress,
        tokenId: 0, // We'll use tokenId 0 as a placeholder for unminted tokens
        startTimestamp: launchData.startTime,
        endTimestamp: launchData.endTime,
        quantity: launchData.totalSupply,
        currency: ethers.ZeroAddress, // Using ETH as currency
        pricePerToken: launchData.price,
        reserved: true, // Enable whitelist if needed
      };

      const marketplaceContract =
        await this.marketplaceService.getEthersMarketplaceContract();
      // Create listing transaction
      const unsignedTx =
        await marketplaceContract.createListing.populateTransaction(
          listing
        );

      const launchItems = [
        {
          fileKey: "asset1.jpg",
          metadata: {
            name: "Asset #1",
            description: "First asset",
            // attributes: [
            //   /*...*/
            // ],
          },
        },
      ];

      // const buyTransactions = launchItems.map((item, index) => {
      //   return ethersMarketplaceContract.createListing.populateTransaction(
      //     Math.floor(index / 20), // listingId based on batch size of 20
      //     buyerAddress,
      //     1, // quantity per token
      //     ethers.ZeroAddress,
      //     launch.isWhitelisted && isInWhitelistPeriod(launch)
      //       ? ethers.parseEther(launch.wlMintPrice!.toString())
      //       : ethers.parseEther(launch.poMintPrice.toString())
      //   );
      // });

      return this.prepareUnsignedTransaction(unsignedTx, ownerAddress);
    } catch (error) {
      console.error("Error creating launchpad listing:", error);
      throw error;
    }
  }

  private async prepareUnsignedTransaction(
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
