import { ethers } from "ethers";
import * as fs from "fs";

// Configuration
const VAULT_ADDRESS =
  "0xbF44d42BED5dA7eE02095904F9A1Cb1C916d723c".toLowerCase();
const NFT_ADDRESS = "0x68d554EdC75442eD83a670111F78F3C6674BEBbF".toLowerCase();
const RPC_URL = "https://rpc.testnet.citrea.xyz";
const BLOCK_RANGE_LIMIT = 1000;

// Launch time configuration (UTC)
const LAUNCH_START_TIME = "2025-01-30T15:00:00.000Z";
const LAUNCH_END_TIME = "2025-01-30T15:46:50.251Z";

// Minimal ERC721 ABI to check token ownership
const ERC721_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];
// Execute the script with your block range
const START_BLOCK = 5741400; // Replace with your start block
const END_BLOCK = 5793583; // Replace with your end block

async function getBlocksWithTransactions(
  provider: ethers.Provider,
  startBlock: number,
  endBlock: number
): Promise<ethers.TransactionResponse[]> {
  const transactions: ethers.TransactionResponse[] = [];

  for (
    let currentBlock = startBlock;
    currentBlock <= endBlock;
    currentBlock += BLOCK_RANGE_LIMIT
  ) {
    const toBlock = Math.min(currentBlock + BLOCK_RANGE_LIMIT - 1, endBlock);
    console.log(`Fetching blocks ${currentBlock} to ${toBlock}...`);

    try {
      // Get all blocks in the range
      for (let blockNum = currentBlock; blockNum <= toBlock; blockNum++) {
        const block = await provider.getBlock(blockNum);
        if (!block) continue;

        // Get full transaction details for each transaction in the block
        for (const txHash of block.transactions) {
          try {
            const tx = await provider.getTransaction(txHash);
            if (tx?.to?.toLowerCase() === VAULT_ADDRESS) {
              transactions.push(tx);
              console.log(
                `Found vault transaction in block ${blockNum}: ${tx.hash}`
              );
            }
          } catch (error) {
            console.error(`Error fetching transaction ${txHash}:`, error);
          }
        }
      }

      // Add a small delay to prevent rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error fetching blocks ${currentBlock}-${toBlock}:`, error);
      // Retry this block range
      currentBlock -= BLOCK_RANGE_LIMIT;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return transactions;
}

async function getTransferEvents(
  provider: ethers.Provider,
  nftContract: ethers.Contract,
  startBlock: number,
  endBlock: number
): Promise<ethers.Log[]> {
  const events: ethers.Log[] = [];

  for (
    let fromBlock = startBlock;
    fromBlock <= endBlock;
    fromBlock += BLOCK_RANGE_LIMIT
  ) {
    const toBlock = Math.min(fromBlock + BLOCK_RANGE_LIMIT - 1, endBlock);

    try {
      console.log(
        `Fetching NFT transfers for blocks ${fromBlock} to ${toBlock}...`
      );
      const transferFilter = {
        address: NFT_ADDRESS,
        topics: [
          ethers.id("Transfer(address,address,uint256)"),
          null,
          null,
          null
        ],
        fromBlock,
        toBlock
      };

      const logs = await provider.getLogs(transferFilter);
      events.push(...logs);

      // Add delay to prevent rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(
        `Error fetching transfer events for blocks ${fromBlock}-${toBlock}:`,
        error
      );
      fromBlock -= BLOCK_RANGE_LIMIT;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return events;
}

async function getFailedMints(startBlock: number, endBlock: number) {
  try {
    // Connect to network
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Verify connection
    const network = await provider.getNetwork();
    console.log("Connected to network:", {
      chainId: network.chainId,
      name: network.name
    });

    console.log("Using addresses:", {
      vault: VAULT_ADDRESS,
      nft: NFT_ADDRESS
    });

    const nftContract = new ethers.Contract(NFT_ADDRESS, ERC721_ABI, provider);

    // Get all ETH transfers to vault address
    console.log("Fetching ETH transfers to vault...");
    const vaultTransactions = await getBlocksWithTransactions(
      provider,
      startBlock,
      endBlock
    );

    console.log(`Found ${vaultTransactions.length} transfers to vault`);

    // Get unique addresses that paid fees
    const feePayers = new Set<string>();
    for (const tx of vaultTransactions) {
      if (tx.from) {
        feePayers.add(tx.from.toLowerCase());
        console.log(`Found fee payment from: ${tx.from}`);
      }
    }

    console.log(`Found ${feePayers.size} unique addresses that paid fees`);

    // Get NFT transfer events
    console.log("Fetching NFT transfer events...");
    const transferEvents = await getTransferEvents(
      provider,
      nftContract,
      startBlock,
      endBlock
    );

    // Get successful minters
    const successfulMinters = new Set<string>();
    for (const event of transferEvents) {
      try {
        const parsedLog = nftContract.interface.parseLog({
          topics: event.topics as string[],
          data: event.data
        });

        if (parsedLog && parsedLog.args) {
          const minter = parsedLog.args[1].toLowerCase();
          successfulMinters.add(minter);
          console.log(`Found successful mint to: ${minter}`);
        }
      } catch (error) {
        console.error(`Error processing transfer event:`, error);
      }
    }

    console.log(`Found ${successfulMinters.size} successful minters`);

    // Find addresses that paid fees but didn't receive NFT
    const failedMinters = new Set<string>();
    for (const feePayer of feePayers) {
      if (!successfulMinters.has(feePayer)) {
        failedMinters.add(feePayer);
        console.log(`Found failed mint for address: ${feePayer}`);
      }
    }

    // Save results to file
    const failedMintersArray = Array.from(failedMinters);
    const results = {
      blockRange: {
        startBlock,
        endBlock
      },
      totalFeePayers: feePayers.size,
      totalSuccessful: successfulMinters.size,
      totalFailed: failedMinters.size,
      failedAddresses: failedMintersArray,
      // Add transaction details for verification
      transactions: vaultTransactions.map((tx) => ({
        hash: tx.hash,
        from: tx.from,
        value: ethers.formatEther(tx.value),
        blockNumber: tx.blockNumber
      }))
    };

    fs.writeFileSync("failed-minters.json", JSON.stringify(results, null, 2));

    console.log(
      `Found ${failedMinters.size} addresses that paid fees but didn't receive NFT`
    );
    console.log("Results saved to failed-minters.json");

    return failedMintersArray;
  } catch (error) {
    console.error("Error fetching failed mints:", error);
    throw error;
  }
}

getFailedMints(START_BLOCK, END_BLOCK)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
