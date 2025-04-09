import logger from "../../src/config/winston";
import whitelist from "./holders.json";
import { launchItemRepository } from "../../src/repositories/launchItemRepository";
import { db } from "../../src/utils/db";
import { collectibleRepository } from "../../src/repositories/collectibleRepository";
import { collectionRepository } from "../../src/repositories/collectionRepository";
import { EVM_CONFIG } from "blockchain/evm/evm-config";
import { DirectMintNFTService } from "blockchain/evm/services/nftService/directNFTService";
import { ethers } from "ethers";

type WhitelistEntry = {
  address: string;
  count: number;
};

type BatchItem = {
  entry: WhitelistEntry;
  index: number;
};

const entries: WhitelistEntry[] = whitelist;
const COLLECTION_ID = "218011b1-2cec-407c-81b9-c7c3e9a0e8c7";
const ADMIN_USER_ID = "d14e1524-a31f-48b1-b8ad-f48ca267d56b";
const VAULT_ADDRESS = "";
const VAULT_PRIVATE_KEY = "";
const MAX_BATCH_SIZE = 5;

const chainConfig = EVM_CONFIG.CHAINS["43111"];
const contractVersion = "3";
const directMintService = new DirectMintNFTService(
  chainConfig.RPC_URL,
  contractVersion
);

// Initialize provider and wallet
const provider = new ethers.JsonRpcProvider(chainConfig.RPC_URL);
const wallet = new ethers.Wallet(VAULT_PRIVATE_KEY, provider);

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processNFT(
  entry: WhitelistEntry,
  index: number,
  phaseInfo: any
) {
  try {
    // Step 1: Prepare the NFT data - database operations
    const launchItem =
      await launchItemRepository.getRandomItemWithLockedCollectibleStatusByCollectionId(
        COLLECTION_ID
      );
    if (!launchItem) {
      logger.info(
        `No LaunchItem and Collectible found. ${entry.address}, ${index}`
      );
      return null;
    }

    const launchItemToMint = await launchItemRepository.setShortHoldById(
      db,
      launchItem.id,
      ADMIN_USER_ID
    );
    if (!launchItemToMint) {
      logger.info(
        `Could not put the item on hold: ${launchItem.id}. ${entry.address}, ${index}`
      );
      return null;
    }

    const collectible = await collectibleRepository.getById(
      db,
      launchItemToMint.collectibleId
    );
    if (!collectible || !collectible.cid) {
      logger.info(`No collectible found. ${entry.address}, ${index}`);
      return null;
    }

    const collection = await collectionRepository.getById(
      db,
      collectible.collectionId
    );
    if (!collection || !collection.contractAddress) {
      logger.info(`No collection found. ${entry.address}, ${index}`);
      return null;
    }

    // Generate signature for direct minting
    const { signature, uniqueId, timestamp } =
      await directMintService.generateMintSignature(
        collection.contractAddress,
        VAULT_ADDRESS,
        collectible.nftId,
        collectible.cid,
        "0",
        Number(phaseInfo.phaseIndex)
      );

    // Get unsigned transaction for minting
    const unsignedTx = await directMintService.getUnsignedMintTransaction(
      collection.contractAddress,
      collectible.nftId,
      collectible.cid,
      "0",
      uniqueId,
      timestamp,
      signature,
      VAULT_ADDRESS
    );

    return {
      unsignedTx,
      collectible,
      collection,
      index,
      address: entry.address // Store the target address with each item
    };
  } catch (error) {
    logger.error(
      `Error preparing NFT for ${entry.address}, index ${index}:`,
      error
    );
    return null;
  }
}

async function processBatch(batchItems: any[], currentNonce: number) {
  // Filter out any null items (failed preparations)
  const validItems = batchItems.filter((item) => item !== null);
  if (validItems.length === 0) return currentNonce;

  const addresses = [...new Set(validItems.map((item) => item.address))];
  logger.info(
    `Processing batch of ${validItems.length} NFTs for ${
      addresses.length
    } addresses: ${addresses.join(", ")}`
  );

  // Process items sequentially to maintain proper nonces
  let nonce = currentNonce;
  const processedItems = [];

  // Step 2: Mint NFTs sequentially with proper nonce handling
  for (const item of validItems) {
    try {
      // Sign and send the transaction with explicit nonce
      logger.info(
        `Sending mint transaction for ${item.address}, NFT ID: ${item.collectible.nftId} with nonce ${nonce}`
      );

      // Create transaction with explicit nonce
      const tx = {
        ...JSON.parse(item.unsignedTx),
        nonce: ethers.utils.hexlify(nonce)
      };

      const signedTx = await wallet.signTransaction(tx);
      const txResponse = await provider.sendTransaction(signedTx);

      // Increment nonce for next transaction
      nonce++;

      // Wait for transaction confirmation
      logger.info(
        `Waiting for mint transaction confirmation: ${txResponse.hash}`
      );
      const receipt = await txResponse.wait(1); // Wait for 1 confirmation to speed up the process

      if (receipt.status === 1) {
        logger.info(
          `Mint transaction confirmed for NFT #${item.collectible.nftId}: ${txResponse.hash}`
        );
        processedItems.push({ ...item, mintSuccess: true, txReceipt: receipt });
      } else {
        logger.error(
          `Mint transaction failed for NFT #${item.collectible.nftId}: ${txResponse.hash}`
        );
      }
    } catch (error: any) {
      logger.error(
        `Error minting NFT #${item.collectible.nftId} for ${item.address}:`,
        error
      );
      // If the error is nonce-related, we still need to increment the nonce
      if (
        error.message &&
        (error.message.includes("nonce") ||
          error.message.includes("already known"))
      ) {
        logger.warn(
          `Nonce issue detected, incrementing nonce from ${nonce} to ${
            nonce + 1
          }`
        );
        nonce++;
      }
    }
  }

  if (processedItems.length === 0) {
    logger.info(`No successful mints in this batch`);
    return nonce; // Return the updated nonce
  }

  // Step 3: Transfer all successfully minted NFTs sequentially with proper nonce
  const transferredItems = [];

  for (const item of processedItems) {
    try {
      // Get NFT contract instance
      const nftContract = new ethers.Contract(
        item.collection.contractAddress,
        [
          "function transferFrom(address from, address to, uint256 tokenId) external"
        ],
        wallet
      );

      // Create the transfer transaction with explicit nonce
      logger.info(
        `Transferring NFT #${item.collectible.nftId} to ${item.address} with nonce ${nonce}`
      );
      const transferTx = await nftContract.transferFrom(
        VAULT_ADDRESS,
        item.address,
        item.collectible.nftId,
        { nonce: nonce }
      );

      // Increment nonce for next transaction
      nonce++;

      logger.info(
        `Waiting for transfer confirmation for NFT #${item.collectible.nftId}: ${transferTx.hash}`
      );
      const transferReceipt = await transferTx.wait(1);

      if (transferReceipt.status === 1) {
        logger.info(
          `NFT #${item.collectible.nftId} successfully transferred to ${item.address}`
        );
        transferredItems.push({ ...item, transferSuccess: true });
      } else {
        logger.error(
          `Failed to transfer NFT #${item.collectible.nftId} to ${item.address}`
        );
      }
    } catch (error: any) {
      logger.error(
        `Error transferring NFT #${item.collectible.nftId} to ${item.address}:`,
        error
      );
      // If the error is nonce-related, we still need to increment the nonce
      if (
        error.message &&
        (error.message.includes("nonce") ||
          error.message.includes("already known"))
      ) {
        logger.warn(
          `Nonce issue detected, incrementing nonce from ${nonce} to ${
            nonce + 1
          }`
        );
        nonce++;
      }
    }
  }

  // Step 4: Update database for all successfully transferred NFTs (can be done in parallel)
  if (transferredItems.length > 0) {
    const dbUpdatePromises = transferredItems.map(async (item) => {
      try {
        await collectibleRepository.update(db, item.collectible.id, {
          status: "CONFIRMED",
          uniqueIdx:
            item.collection.contractAddress + "i" + item.collectible.nftId
        });

        logger.info(
          `Database updated for NFT #${item.collectible.nftId}, new owner: ${item.address}`
        );
        return { ...item, dbUpdateSuccess: true };
      } catch (error) {
        logger.error(
          `Error updating database for NFT #${item.collectible.nftId}:`,
          error
        );
        return { ...item, dbUpdateSuccess: false };
      }
    });

    // Wait for all database updates to complete
    await Promise.all(dbUpdatePromises);
  }

  logger.info(
    `Batch processing completed. Successfully processed: ${transferredItems.length}/${validItems.length}`
  );

  // Return the updated nonce for the next batch
  return nonce;
}

async function getPhaseInfo() {
  try {
    // We only need to check phase once - we'll use the first collection
    const sampleLaunchItem =
      await launchItemRepository.getRandomItemWithLockedCollectibleStatusByCollectionId(
        COLLECTION_ID
      );
    if (!sampleLaunchItem) {
      logger.error(`No launch items available for collection ${COLLECTION_ID}`);
      return null;
    }

    const sampleCollectible = await collectibleRepository.getById(
      db,
      sampleLaunchItem.collectibleId
    );
    if (!sampleCollectible) {
      logger.error(
        `No collectible found for launch item ${sampleLaunchItem.id}`
      );
      return null;
    }

    const sampleCollection = await collectionRepository.getById(
      db,
      sampleCollectible.collectionId
    );
    if (!sampleCollection || !sampleCollection.contractAddress) {
      logger.error(
        `No collection found or no contract address for collectible ${sampleCollectible.id}`
      );
      return null;
    }

    const phaseInfo = await directMintService.getActivePhase(
      sampleCollection.contractAddress
    );
    if (!phaseInfo.isActive) {
      logger.error(
        `Phase not active for collection ${sampleCollection.contractAddress}`
      );
      return null;
    }

    return phaseInfo;
  } catch (error) {
    logger.error(`Error checking phase status:`, error);
    return null;
  }
}

async function airdrop() {
  // Track total progress
  let totalProcessed = 0;
  const startTime = Date.now();

  // Get total NFTs to be minted
  const totalToMint = entries.reduce((sum, entry) => sum + entry.count, 0);
  logger.info(`Total NFTs to mint: ${totalToMint}`);

  // Get the current nonce for the wallet
  let currentNonce = await provider.getTransactionCount(VAULT_ADDRESS);
  logger.info(
    `Starting with nonce ${currentNonce} for address ${VAULT_ADDRESS}`
  );

  // Check if phase is active before starting
  const phaseInfo = await getPhaseInfo();
  if (!phaseInfo) {
    logger.error("Cannot proceed: phase check failed");
    return;
  }

  // Create a flat list of all items to be minted
  const allItems: BatchItem[] = [];
  for (const entry of entries) {
    for (let i = 1; i <= entry.count; i++) {
      allItems.push({ entry, index: i });
    }
  }

  // Process items in batches of MAX_BATCH_SIZE
  for (let i = 0; i < allItems.length; i += MAX_BATCH_SIZE) {
    const batchItems = allItems.slice(i, i + MAX_BATCH_SIZE);
    const batchNumber = Math.floor(i / MAX_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(allItems.length / MAX_BATCH_SIZE);

    logger.info(
      `Preparing batch ${batchNumber} of ${totalBatches}, containing ${batchItems.length} NFTs`
    );

    // Prepare all NFTs in this batch concurrently
    const preparePromises = batchItems.map((item) =>
      processNFT(item.entry, item.index, phaseInfo)
    );

    // Wait for all preparations to complete
    const preparedItems = await Promise.all(preparePromises);

    // Process this batch on-chain and update nonce
    currentNonce = await processBatch(preparedItems, currentNonce);

    // Update progress
    totalProcessed += batchItems.length;
    const elapsedMinutes = (Date.now() - startTime) / 60000;
    const itemsPerMinute = totalProcessed / elapsedMinutes;
    const estimatedTotalTime = totalToMint / itemsPerMinute;
    const estimatedTimeRemaining = estimatedTotalTime - elapsedMinutes;

    logger.info(
      `Progress: ${totalProcessed}/${totalToMint} items processed (${(
        (totalProcessed / totalToMint) *
        100
      ).toFixed(2)}%)`
    );
    logger.info(
      `Current rate: ${itemsPerMinute.toFixed(
        2
      )} items/minute. Estimated time remaining: ${estimatedTimeRemaining.toFixed(
        2
      )} minutes`
    );

    // Small delay between batches to avoid overloading the RPC
    if (i + MAX_BATCH_SIZE < allItems.length) {
      await sleep(3000);
    }
  }
}

airdrop()
  .then(() => {
    console.log(`Successfully processed the airdrop`);
  })
  .catch((error) => {
    console.error(`Airdrop failed:`, error);
    process.exit(1);
  });
