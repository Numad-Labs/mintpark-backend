import { ethers } from "ethers";
import { EVM_CONFIG } from "../evm-config";
import MarketplaceService from "./marketplaceService";
import NFTService from "./nftService";
import { Launch, LaunchItem } from "../../../src/types/db/types";
import { CustomError } from "../../../src/exceptions/CustomError";
import { TransactionConfirmationService } from "./transactionConfirmationService";
import { PinataSDK } from "pinata-web3";
import { config } from "../../../src/config/config";
import { LaunchConfig } from "../../../custom";
import { createMetadataFromS3File } from "../../../src/utils/aws";
import { launchItemRepository } from "../../../src/repositories/launchItemRepository";
import { db } from "../../../src/utils/db";

const nftService = new NFTService(
  EVM_CONFIG.RPC_URL,
  EVM_CONFIG.MARKETPLACE_ADDRESS,
  new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS)
);

const confirmationService = new TransactionConfirmationService(
  EVM_CONFIG.RPC_URL!
);

class LaunchpadService {
  private provider: ethers.JsonRpcProvider;
  private storage: PinataSDK;
  private marketplaceService: MarketplaceService;

  constructor(providerUrl: string, marketplaceService: MarketplaceService) {
    this.provider = new ethers.JsonRpcProvider(providerUrl);
    this.marketplaceService = marketplaceService;

    this.storage = new PinataSDK({
      pinataJwt: config.PINATA_JWT,
      pinataGateway: config.PINATA_GATEWAY_URL,
    });
  }

  async createLaunchpadListingWithAssets(
    launchConfig: LaunchConfig,
    ownerAddress: string,
    totalSupply: number
  ) {
    try {
      const signer = await this.provider.getSigner();

      const nftContract = new ethers.Contract(
        launchConfig.collectionAddress,
        EVM_CONFIG.NFT_CONTRACT_ABI,
        signer
      );

      // Check if the marketplace is already approved
      const isApproved = await nftContract.isApprovedForAll(
        ownerAddress,
        EVM_CONFIG.MARKETPLACE_ADDRESS
      );
      console.log("🚀 ~ NFTService ~ isApproved:", isApproved);

      if (!isApproved) {
        console.log("Approval needed. Preparing approval transaction...");
        const approvalTx =
          await nftContract.setApprovalForAll.populateTransaction(
            EVM_CONFIG.MARKETPLACE_ADDRESS,
            true
          );
        const preparedApprovalTx = await nftService.prepareUnsignedTransaction(
          approvalTx,
          ownerAddress
        );

        // Return the approval transaction instead of the listing transaction
        return {
          type: "approval",
          transaction: preparedApprovalTx,
        };
      }
      // 3. Prepare marketplace listing transactions for each batch
      const BATCH_SIZE = 1; // Adjust based on gas limits
      const batchCount = Math.ceil(totalSupply / BATCH_SIZE);

      const listingTransactions = [];

      // Get the marketplace contract
      const marketplaceContract =
        await this.marketplaceService.getEthersMarketplaceContract();

      for (let i = 0; i < batchCount; i++) {
        const batchQuantity = Math.min(
          BATCH_SIZE,
          totalSupply - i * BATCH_SIZE
        );
        console.log("🚀 ~ LaunchpadService ~ batchQuantity:", batchQuantity);
        const startTokenId = i * BATCH_SIZE;

        const listing = {
          assetContract: launchConfig.collectionAddress,
          tokenId: startTokenId,
          startTimestamp: launchConfig.startTime,
          endTimestamp: launchConfig.endTime,
          quantity: 1,
          currency: ethers.ZeroAddress,
          pricePerToken: ethers.parseEther(launchConfig.price),
          reserved: launchConfig.isWhitelisted,
        };

        // Create listing transaction for this batch
        const listingTx =
          await marketplaceContract.createListing.populateTransaction(listing);

        listingTransactions.push(listingTx.data);
      }
      console.log(
        "🚀 ~ LaunchpadService ~ listingTransactions:",
        listingTransactions
      );

      // 4. Create multicall transaction
      const multicallTx =
        await marketplaceContract.multicall.populateTransaction(
          listingTransactions
        );

      // 5. Prepare final transaction
      return nftService.prepareUnsignedTransaction(multicallTx, ownerAddress);
    } catch (error) {
      console.error("Error creating launchpad listing:", error);
      throw error;
    }
  }

  // async mintAndBuyFromListing(
  //   listingId: string,
  //   buyerAddress: string,
  //   quantity: number,
  //   collectionAddress: string,
  //   metadata: any
  // ) {
  //   try {
  //     // First, upload metadata to IPFS
  //     const metadataUri = await this.storage.upload.file(metadata);

  //     // Get the NFT contract
  //     const nftContract = new ethers.Contract(
  //       collectionAddress,
  //       EVM_CONFIG.NFT_CONTRACT_ABI,
  //       this.provider
  //     );

  //     // Create batch transaction
  //     const mintTx = await nftContract.safeMint.populateTransaction(
  //       buyerAddress,
  //       quantity,
  //       metadataUri
  //     );

  //     // Get the marketplace contract
  //     const marketplaceContract =
  //       await this.marketplaceService.getEthersMarketplaceContract();

  //     // Create buy transaction
  //     const buyTx =
  //       await marketplaceContract.buyFromListing.populateTransaction(
  //         listingId,
  //         buyerAddress,
  //         quantity,
  //         ethers.ZeroAddress, // ETH as currency
  //         ethers.parseEther(metadata.price) // Price from metadata
  //       );

  //     // Combine transactions using multicall
  //     const multicallTx =
  //       await marketplaceContract.multicall.populateTransaction([
  //         mintTx.data,
  //         buyTx.data,
  //       ]);

  //     return nftService.prepareUnsignedTransaction(multicallTx, buyerAddress);
  //   } catch (error) {
  //     console.error("Error minting and buying:", error);
  //     throw error;
  //   }
  // }

  async createLaunchpadContractFeeChange(
    collectionTxid: string,
    ownerAddress: string,
    mintFee: string
  ) {
    try {
      if (!collectionTxid) throw new Error("txid not found.");
      const transactionDetail = await confirmationService.getTransactionDetails(
        collectionTxid
      );

      if (transactionDetail.status !== 1) {
        throw new CustomError(
          "Transaction not confirmed. Please try again.",
          500
        );
      }

      if (!transactionDetail.deployedContractAddress) {
        throw new CustomError(
          "Transaction does not contain deployed contract address.",
          500
        );
      }

      // Get the NFT contract
      const nftContract = new ethers.Contract(
        transactionDetail.deployedContractAddress,
        EVM_CONFIG.NFT_CONTRACT_ABI,
        this.provider
      );

      // Create batch transaction
      const mintTx = await nftContract.setMintFee.populateTransaction(
        ethers.parseEther(mintFee)
      );

      return nftService.prepareUnsignedTransaction(mintTx, ownerAddress);
    } catch (error) {
      console.error("Error minting and buying:", error);
      throw error;
    }
  }

  async getUnsignedLaunchMintTransaction(
    // launch: Launchtype,
    winnerItem: any,
    buyer: string,
    collectionAddress: string
  ): Promise<ethers.TransactionRequest> {
    const signer = await this.provider.getSigner();

    // Generate tokenId if not already set
    const tokenId = winnerItem.evmAssetId
      ? parseInt(winnerItem.evmAssetId)
      : this.generateTokenId(winnerItem);

    const metadataURI = await createMetadataFromS3File(
      winnerItem.fileKey,
      winnerItem.name || "Unnamed NFT",
      this.storage
    );

    console.log("🚀 ~ LaunchpadService ~ metadataURI:", metadataURI);

    await launchItemRepository.update(db, winnerItem.id, {
      ipfsUrl: metadataURI,
    });

    const nftContract = new ethers.Contract(
      collectionAddress,
      EVM_CONFIG.NFT_CONTRACT_ABI,
      signer
    );

    const price = await nftContract.mintFee();
    if (price === undefined) {
      throw new CustomError("No active sale phase", 400);
    }
    const mintPrice = ethers.formatEther(price);
    console.log("🚀 ~ LaunchpadService ~ mintPrice:", mintPrice);

    // Prepare transaction data
    const unsignedTx = await nftContract.mint.populateTransaction(
      tokenId,
      metadataURI,
      { value: ethers.parseEther(mintPrice) }
    );

    // Prepare the full transaction
    return await nftService.prepareUnsignedTransaction(unsignedTx, buyer);
  }

  private generateTokenId(items: LaunchItem[]): number {
    const existingIds = items
      .map((item) => item.evmAssetId)
      .filter((id): id is string => id !== null)
      .map((id) => parseInt(id));

    if (existingIds.length === 0) {
      return 0;
    }

    return Math.max(...existingIds) + 1;
  }
}

export default LaunchpadService;
