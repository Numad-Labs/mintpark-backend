import { ethers } from "ethers";
import * as fs from "fs";

// Configuration
const VAULT_ADDRESS =
  "0xbF44d42BED5dA7eE02095904F9A1Cb1C916d723c".toLowerCase();
const NFT_ADDRESS = "0x68d554EdC75442eD83a670111F78F3C6674BEBbF".toLowerCase();
const RPC_URL = "https://rpc.testnet.citrea.xyz";
const BLOCK_RANGE_LIMIT = 1000; // Maximum range for RPC queries
const BATCH_SIZE = BLOCK_RANGE_LIMIT; // Process in max RPC limit sizes

// Block range configuration
const START_BLOCK = 5741400;
const END_BLOCK = 5793583;

const PROGRESS_FILE = "batch_progress.json";
const RESULTS_DIR = "batch_results";

interface BatchProgress {
  lastProcessedBlock: number;
  processedBatches: number[];
}

interface BatchResult {
  startBlock: number;
  endBlock: number;
  feePayers: string[];
  successfulMinters: string[];
  transactions: Array<{
    hash: string;
    from: string;
    value: string;
    blockNumber: number;
  }>;
}

function initializeProgress(): BatchProgress {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
  }
  return {
    lastProcessedBlock: START_BLOCK - 1,
    processedBatches: []
  };
}

function saveProgress(progress: BatchProgress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function saveBatchResult(batchNumber: number, result: BatchResult) {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR);
  }
  fs.writeFileSync(
    `${RESULTS_DIR}/batch_${batchNumber}.json`,
    JSON.stringify(result, null, 2)
  );
}

async function getVaultTransactions(
  provider: ethers.Provider,
  startBlock: number,
  endBlock: number
): Promise<ethers.TransactionResponse[]> {
  console.log(
    `Fetching vault transactions for blocks ${startBlock} to ${endBlock}...`
  );
  const transactions: ethers.TransactionResponse[] = [];

  try {
    for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
      // Get block with transaction hashes
      const block = await provider.getBlock(blockNumber);
      if (!block?.transactions?.length) continue;

      // Get full transaction details for each hash
      for (const txHash of block.transactions) {
        try {
          const tx = await provider.getTransaction(txHash);
          if (
            tx &&
            tx.to?.toLowerCase() === VAULT_ADDRESS &&
            tx.value > BigInt(0)
          ) {
            transactions.push(tx);
            console.log(`Found vault transaction in block ${blockNumber}:`);
            console.log(`  Hash: ${tx.hash}`);
            console.log(`  From: ${tx.from}`);
            console.log(`  Value: ${ethers.formatEther(tx.value)} ETH`);
          }
        } catch (error) {
          console.error(`Error fetching transaction ${txHash}:`, error);
        }
      }

      // Add a small delay every 10 blocks to prevent rate limiting
      if (blockNumber % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  } catch (error) {
    console.error(`Error fetching vault transactions:`, error);
    throw error;
  }

  return transactions;
}

async function getNFTTransfers(
  provider: ethers.Provider,
  nftContract: ethers.Contract,
  startBlock: number,
  endBlock: number
): Promise<Set<string>> {
  console.log(
    `Fetching NFT transfers for blocks ${startBlock} to ${endBlock}...`
  );
  const successfulMinters = new Set<string>();

  try {
    const transferFilter = {
      address: NFT_ADDRESS,
      topics: [ethers.id("Transfer(address,address,uint256)")],
      fromBlock: startBlock,
      toBlock: endBlock
    };

    const transferLogs = await provider.getLogs(transferFilter);

    for (const log of transferLogs) {
      try {
        const parsedLog = nftContract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data
        });
        if (parsedLog?.args) {
          const to = parsedLog.args[1].toLowerCase();
          successfulMinters.add(to);
          console.log(`Found successful mint to: ${to}`);
        }
      } catch (error) {
        console.error("Error processing transfer log:", error);
      }
    }
  } catch (error) {
    console.error(`Error fetching NFT transfers:`, error);
    throw error;
  }

  return successfulMinters;
}

async function processBatch(
  provider: ethers.Provider,
  startBlock: number,
  endBlock: number
): Promise<BatchResult> {
  console.log(`\nProcessing batch: blocks ${startBlock} to ${endBlock}`);

  const nftContract = new ethers.Contract(
    NFT_ADDRESS,
    [
      "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
    ],
    provider
  );

  // Get vault transactions
  const vaultTransactions = await getVaultTransactions(
    provider,
    startBlock,
    endBlock
  );

  console.log(
    `Found ${vaultTransactions.length} vault transactions in this batch`
  );

  // Get unique fee payers
  const feePayers = new Set<string>();
  for (const tx of vaultTransactions) {
    if (tx.from) {
      feePayers.add(tx.from.toLowerCase());
    }
  }

  // Get successful minters
  const successfulMinters = await getNFTTransfers(
    provider,
    nftContract,
    startBlock,
    endBlock
  );

  console.log(`Found ${successfulMinters.size} successful mints in this batch`);

  return {
    startBlock,
    endBlock,
    feePayers: Array.from(feePayers),
    successfulMinters: Array.from(successfulMinters),
    transactions: vaultTransactions.map((tx) => ({
      hash: tx.hash,
      from: tx.from!,
      value: ethers.formatEther(tx.value),
      blockNumber: tx.blockNumber!
    }))
  };
}

async function processAllBatches() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // Add retries for provider
  provider.pollingInterval = 1000;
  const network = await provider.getNetwork();
  console.log("Connected to network:", {
    chainId: network.chainId,
    name: network.name
  });

  const progress = initializeProgress();

  // Calculate remaining batches
  let currentBlock = Math.max(START_BLOCK, progress.lastProcessedBlock + 1);

  while (currentBlock <= END_BLOCK) {
    const batchEndBlock = Math.min(currentBlock + BATCH_SIZE - 1, END_BLOCK);
    const batchNumber = Math.floor((currentBlock - START_BLOCK) / BATCH_SIZE);

    if (!progress.processedBatches.includes(batchNumber)) {
      try {
        const batchResult = await processBatch(
          provider,
          currentBlock,
          batchEndBlock
        );

        saveBatchResult(batchNumber, batchResult);

        // Update progress
        progress.lastProcessedBlock = batchEndBlock;
        progress.processedBatches.push(batchNumber);
        saveProgress(progress);

        console.log(`Completed batch ${batchNumber}\n`);
      } catch (error) {
        console.error(`Error processing batch ${batchNumber}:`, error);
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
    }

    currentBlock = batchEndBlock + 1;
  }

  // Combine all results
  console.log("\nProcessing complete. Combining results...");
  const allFeePayers = new Set<string>();
  const allSuccessfulMinters = new Set<string>();
  const allTransactions: BatchResult["transactions"] = [];

  for (const batchNumber of progress.processedBatches) {
    const batchFile = `${RESULTS_DIR}/batch_${batchNumber}.json`;
    if (fs.existsSync(batchFile)) {
      const batchResult: BatchResult = JSON.parse(
        fs.readFileSync(batchFile, "utf8")
      );
      batchResult.feePayers.forEach((addr) => allFeePayers.add(addr));
      batchResult.successfulMinters.forEach((addr) =>
        allSuccessfulMinters.add(addr)
      );
      allTransactions.push(...batchResult.transactions);
    }
  }

  // Find failed minters
  const failedMinters = new Set<string>();
  for (const feePayer of allFeePayers) {
    if (!allSuccessfulMinters.has(feePayer)) {
      failedMinters.add(feePayer);
    }
  }

  // Save final results
  const finalResults = {
    blockRange: {
      startBlock: START_BLOCK,
      endBlock: END_BLOCK
    },
    totalFeePayers: allFeePayers.size,
    totalSuccessful: allSuccessfulMinters.size,
    totalFailed: failedMinters.size,
    failedAddresses: Array.from(failedMinters),
    transactions: allTransactions
  };

  fs.writeFileSync("final_results.json", JSON.stringify(finalResults, null, 2));
  console.log("\nFinal results saved to final_results.json");
  console.log(`Total fee payers: ${allFeePayers.size}`);
  console.log(`Total successful minters: ${allSuccessfulMinters.size}`);
  console.log(`Total failed minters: ${failedMinters.size}`);
}

// Run the script
processAllBatches()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
