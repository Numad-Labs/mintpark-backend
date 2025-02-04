import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

// Configuration
const NFT_ADDRESS = "0x68d554EdC75442eD83a670111F78F3C6674BEBbF".toLowerCase();
const RPC_URL = "https://rpc.testnet.citrea.xyz";
const BATCH_SIZE = 100; // Number of addresses to check in each batch
const BATCH_DIR = "./batch_results"; // Directory containing batch files

// Multicall contract interface
const MULTICALL_ABI = [
  "function aggregate(tuple(address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)"
];
const MULTICALL_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

interface BatchData {
  startBlock: number;
  endBlock: number;
  feePayers: string[];
  successfulMinters: string[];
  failedMinters?: string[];
  transactions: {
    hash: string;
    from: string;
    value: string;
    blockNumber: number;
  }[];
}

async function loadAllBatchFiles(): Promise<Map<string, BatchData>> {
  const batchFiles = new Map<string, BatchData>();

  const files = fs
    .readdirSync(BATCH_DIR)
    .filter((file) => file.startsWith("batch_") && file.endsWith(".json"))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || "0");
      const numB = parseInt(b.match(/\d+/)?.[0] || "0");
      return numA - numB;
    });

  for (const file of files) {
    const filePath = path.join(BATCH_DIR, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      batchFiles.set(file, data);
      console.log(`Loaded ${file}`);
    } catch (error) {
      console.error(`Error loading ${file}:`, error);
    }
  }

  return batchFiles;
}

async function checkOwnership(batchFiles: Map<string, BatchData>) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const multicall = new ethers.Contract(
    MULTICALL_ADDRESS,
    MULTICALL_ABI,
    provider
  );
  const nftInterface = new ethers.Interface([
    "function balanceOf(address owner) view returns (uint256)"
  ]);

  // Collect all unique addresses
  const uniqueAddresses = new Set<string>();
  for (const [filename, batchData] of batchFiles) {
    if (!batchData.feePayers || batchData.feePayers.length === 0) {
      console.log(`Skipping ${filename} - no fee payers found`);
      continue;
    }
    console.log(
      `Processing ${filename} with ${batchData.feePayers.length} fee payers`
    );
    batchData.feePayers.forEach((address) =>
      uniqueAddresses.add(address.toLowerCase())
    );
  }

  const addresses = Array.from(uniqueAddresses);
  const ownershipMap = new Map<string, boolean>();

  // Process addresses in batches
  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batchAddresses = addresses.slice(i, i + BATCH_SIZE);
    const calls = batchAddresses.map((address) => ({
      target: NFT_ADDRESS,
      callData: nftInterface.encodeFunctionData("balanceOf", [address])
    }));

    try {
      console.log(`Making multicall request for batch ${i / BATCH_SIZE}...`);
      const [blockNumber, returnData] = await multicall.aggregate(calls);
      console.log(`Got response from block ${blockNumber}`);

      for (let j = 0; j < batchAddresses.length; j++) {
        const address = batchAddresses[j];
        try {
          if (!returnData[j] || returnData[j] === "0x") {
            console.warn(
              `Empty data received for address ${address}, assuming balance 0`
            );
            ownershipMap.set(address, false);
            continue;
          }

          const decodedResult = nftInterface.decodeFunctionResult(
            "balanceOf",
            returnData[j]
          );

          if (!decodedResult || !decodedResult[0]) {
            console.warn(
              `Invalid decoded result for address ${address}, assuming balance 0`
            );
            ownershipMap.set(address, false);
            continue;
          }

          const balance = ethers.toNumber(decodedResult[0]);
          ownershipMap.set(address, balance > 0);
          console.log(`Address ${address} has balance: ${balance}`);
        } catch (decodeError) {
          console.warn(
            `Error decoding result for address ${address}:`,
            decodeError
          );
          ownershipMap.set(address, false);
        }
      }

      console.log(
        `Processed ${i + batchAddresses.length}/${addresses.length} addresses`
      );

      // Add small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error in batch ${i / BATCH_SIZE}:`, error);
      // Add longer delay for errors
      await new Promise((resolve) => setTimeout(resolve, 5000));
      i -= BATCH_SIZE; // Retry this batch
      continue;
    }
  }

  // Update and save results for each batch file
  for (const [filename, batchData] of batchFiles) {
    const verifiedMinters = batchData.feePayers.filter((address) =>
      ownershipMap.get(address.toLowerCase())
    );

    const updatedBatchData = {
      ...batchData,
      successfulMinters: verifiedMinters,
      failedMinters: batchData.feePayers.filter(
        (address) => !ownershipMap.get(address.toLowerCase())
      )
    };

    const filePath = path.join(BATCH_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(updatedBatchData, null, 2));
    console.log(`Updated results saved to ${filename}`);
  }

  return batchFiles;
}

async function main() {
  try {
    console.log("Loading batch files...");
    const batchFiles = await loadAllBatchFiles();
    console.log(`Loaded ${batchFiles.size} batch files`);

    console.log("\nChecking NFT ownership...");
    await checkOwnership(batchFiles);

    // Print summary
    let totalFeePayers = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;

    for (const [filename, data] of batchFiles) {
      totalFeePayers += data.feePayers.length;
      totalSuccessful += data.successfulMinters.length;
      totalFailed += data.failedMinters?.length || 0;
    }

    console.log("\nFinal Summary:");
    console.log(`Total Fee Payers: ${totalFeePayers}`);
    console.log(`Total Successful Minters: ${totalSuccessful}`);
    console.log(`Total Failed Minters: ${totalFailed}`);
  } catch (error) {
    console.error("Error processing batches:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
