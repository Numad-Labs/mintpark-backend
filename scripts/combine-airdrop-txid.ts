import fs from "fs";
import path from "path";

// Types
interface UserData {
  address: string;
  userLayerId: string;
  userId: string;
  orderId: string;
}

interface Transaction {
  hash: string;
  from: string;
  value: string;
  blockNumber: number;
}

interface BatchData {
  startBlock: number;
  endBlock: number;
  feePayers: string[];
  successfulMinters: string[];
  transactions: Transaction[];
}

interface CombinedData extends UserData {
  transaction?: {
    hash: string;
    value: string;
    blockNumber: number;
  };
}

// Read and parse the user data
const userData: UserData[] = JSON.parse(
  fs.readFileSync("./combined-data-airdrop.json", "utf-8")
);

// Create a map to store first transaction for each address
const addressToTransactionMap = new Map<string, Transaction>();

// Process all batch files
const batchFolder = "./batch_results";
const batchFiles = fs
  .readdirSync(batchFolder)
  .filter((file) => file.startsWith("batch_") && file.endsWith(".json"));

for (const batchFile of batchFiles) {
  const batchData: BatchData = JSON.parse(
    fs.readFileSync(path.join(batchFolder, batchFile), "utf-8")
  );

  // Process transactions in this batch
  for (const transaction of batchData.transactions) {
    const lowerCaseAddress = transaction.from.toLowerCase();

    // Only store the first transaction for each address
    if (!addressToTransactionMap.has(lowerCaseAddress)) {
      addressToTransactionMap.set(lowerCaseAddress, transaction);
    }
  }
}

// Combine the data
const combinedData: CombinedData[] = userData.map((user) => {
  const lowerCaseAddress = user.address.toLowerCase();
  const transaction = addressToTransactionMap.get(lowerCaseAddress);

  if (transaction) {
    return {
      ...user,
      transaction: {
        hash: transaction.hash,
        value: transaction.value,
        blockNumber: transaction.blockNumber
      }
    };
  }

  return user;
});

// Write the combined data to a file
fs.writeFileSync(
  "combined-airdrop-txid.json",
  JSON.stringify(combinedData, null, 2)
);

console.log(
  `Processing complete. Found transactions for ${
    combinedData.filter((data) => data.transaction).length
  } out of ${combinedData.length} addresses.`
);
