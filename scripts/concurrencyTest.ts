// import NFTService from "blockchain/evm/services/nftService";
// import { ethers } from "ethers";

// // Configuration
// const RPC_URL = "https://rpc.testnet.citrea.xyz";
// const COLLECTION_ADDRESS = "0xC1DB29eD4CfC57F3915a6fF51545CC82FBeE5865";
// const MINT_PRICE = "0"; // ETH
// const VAULT_ADDRESS = "0x4a3A744DD6Bb638498daC3702F36ABE609676614";
// const VAULT_PRIVATE_KEY =
//   "9ef93dd299374a019146e3f7d78b199ddd4729d89bc08004a4539f6fd0b06ec5";

// // Test data
// const TEST_WALLETS = [
//   // Add test wallet addresses that will receive NFTs
//   "0x62A64Ad869909F0346023dBceCB6Ff635dc93bb6",
//   "0xbF44d42BED5dA7eE02095904F9A1Cb1C916d723c"
// ];

// // Error types
// interface MintError {
//   code: string;
//   message: string;
//   type: "NONCE" | "TIMEOUT" | "GAS" | "CONTRACT" | "OTHER";
// }
// interface MintResult {
//   nftId: string;
//   recipient: string;
//   success: boolean;
//   error?: MintError;
//   txHash?: string;
// }

// const TEST_NFT_IDS = Array.from({ length: 100 }, (_, i) =>
//   (i + 1000).toString()
// );
// const TEST_IPFS_URI = "ipfs://QmTest..."; // Test IPFS URI

// class MintStressTest {
//   private nftService: NFTService;
//   private mintingResults: {
//     success: number;
//     failed: number;
//     errors: MintError[];
//     results: MintResult[];
//   };

//   constructor() {
//     this.nftService = new NFTService(RPC_URL);
//     this.mintingResults = {
//       success: 0,
//       failed: 0,
//       errors: [],
//       results: []
//     };
//   }

//   private categorizeError(error: unknown): MintError {
//     if (error instanceof Error) {
//       const errorMessage = error.message.toLowerCase();

//       // Extract error code if it's an ethers error
//       let errorCode = "";
//       if ("code" in error && typeof error.code === "string") {
//         errorCode = error.code;
//       }

//       // Categorize error
//       if (errorMessage.includes("nonce") || errorCode.includes("NONCE")) {
//         return {
//           code: errorCode,
//           message: error.message,
//           type: "NONCE"
//         };
//       } else if (
//         errorMessage.includes("timeout") ||
//         errorCode.includes("TIMEOUT")
//       ) {
//         return {
//           code: errorCode,
//           message: error.message,
//           type: "TIMEOUT"
//         };
//       } else if (errorMessage.includes("gas") || errorCode.includes("GAS")) {
//         return {
//           code: errorCode,
//           message: error.message,
//           type: "GAS"
//         };
//       } else if (
//         errorMessage.includes("contract") ||
//         errorCode.includes("CONTRACT")
//       ) {
//         return {
//           code: errorCode,
//           message: error.message,
//           type: "CONTRACT"
//         };
//       }

//       return {
//         code: errorCode,
//         message: error.message,
//         type: "OTHER"
//       };
//     }

//     return {
//       code: "UNKNOWN",
//       message: String(error),
//       type: "OTHER"
//     };
//   }

//   async simulateMint(
//     recipientAddress: string,
//     nftId: string
//   ): Promise<MintResult> {
//     try {
//       console.log(`Starting mint for NFT ID ${nftId} to ${recipientAddress}`);

//       const txHash = await this.nftService.mintIpfsNFTUsingVault(
//         COLLECTION_ADDRESS,
//         recipientAddress,
//         nftId,
//         TEST_IPFS_URI,
//         Number(MINT_PRICE)
//       );

//       console.log(`Mint successful for NFT ID ${nftId}. TxHash: ${txHash}`);
//       this.mintingResults.success++;

//       return {
//         nftId,
//         recipient: recipientAddress,
//         success: true,
//         txHash
//       };
//     } catch (error) {
//       const categorizedError = this.categorizeError(error);
//       console.error(`Mint failed for NFT ID ${nftId}:`, categorizedError);

//       this.mintingResults.failed++;
//       this.mintingResults.errors.push(categorizedError);

//       return {
//         nftId,
//         recipient: recipientAddress,
//         success: false,
//         error: categorizedError
//       };
//     }
//   }

//   async runBatchTest(batchSize: number, concurrentMints: number) {
//     console.log(
//       `Starting batch test with size ${batchSize} and ${concurrentMints} concurrent mints`
//     );

//     // Initialize NFT service before starting batch
//     // await this.nftService.initialize();

//     for (let i = 0; i < batchSize; i += concurrentMints) {
//       const currentBatch = TEST_NFT_IDS.slice(i, i + concurrentMints);
//       const mintPromises = currentBatch.map((nftId, index) => {
//         const recipientAddress = TEST_WALLETS[index % TEST_WALLETS.length];
//         // Add delay between mints in the same batch
//         return this.simulateMint(recipientAddress, nftId);
//         // new Promise((r) => setTimeout(r, index * 200)).then(() =>
//         // );
//       });

//       const results = await Promise.allSettled(mintPromises);

//       // Process results...
//       results.forEach((result, index) => {
//         if (result.status === "fulfilled") {
//           this.mintingResults.results.push(result.value);
//         } else {
//           const nftId = currentBatch[index];
//           const recipientAddress = TEST_WALLETS[index % TEST_WALLETS.length];
//           const error = this.categorizeError(result.reason);

//           this.mintingResults.results.push({
//             nftId,
//             recipient: recipientAddress,
//             success: false,
//             error
//           });
//         }
//       });

//       // // Add longer delay between batches
//       // if (i + concurrentMints < batchSize) {
//       //   await new Promise((resolve) => setTimeout(resolve, 3000));
//       // }
//     }
//   }

//   async monitorNetwork() {
//     const initialBlock = await this.nftService.provider.getBlockNumber();
//     let lastNonce = await this.nftService.provider.getTransactionCount(
//       VAULT_ADDRESS
//     );
//     let monitorStartTime = Date.now();

//     const monitor = setInterval(async () => {
//       try {
//         const currentBlock = await this.nftService.provider.getBlockNumber();
//         const currentNonce = await this.nftService.provider.getTransactionCount(
//           VAULT_ADDRESS
//         );
//         const feeData = await this.nftService.provider.getFeeData();
//         const elapsedTime = Date.now() - monitorStartTime;

//         console.log({
//           timestamp: new Date().toISOString(),
//           elapsedSeconds: Math.floor(elapsedTime / 1000),
//           blockNumber: currentBlock,
//           blocksPassed: currentBlock - initialBlock,
//           vaultNonce: currentNonce,
//           nonceIncrement: currentNonce - lastNonce,
//           gasPrice: ethers.formatUnits(feeData.gasPrice || BigInt(0), "gwei"),
//           maxFeePerGas: feeData.maxFeePerGas
//             ? ethers.formatUnits(feeData.maxFeePerGas, "gwei")
//             : null,
//           successCount: this.mintingResults.success,
//           failureCount: this.mintingResults.failed,
//           successRate: `${(
//             (this.mintingResults.success /
//               (this.mintingResults.success + this.mintingResults.failed)) *
//             100
//           ).toFixed(2)}%`
//         });

//         lastNonce = currentNonce;
//       } catch (error) {
//         const categorizedError = this.categorizeError(error);
//         console.error("Monitor error:", categorizedError);
//       }
//     }, 5000);

//     return () => clearInterval(monitor);
//   }

//   logResults() {
//     console.log("\nTest Results:");
//     console.log("=============");
//     console.log(`Total Success: ${this.mintingResults.success}`);
//     console.log(`Total Failed: ${this.mintingResults.failed}`);
//     console.log(
//       `Success Rate: ${(
//         (this.mintingResults.success /
//           (this.mintingResults.success + this.mintingResults.failed)) *
//         100
//       ).toFixed(2)}%`
//     );

//     if (this.mintingResults.errors.length > 0) {
//       console.log("\nError Analysis:");
//       const errorTypes = new Map<string, number>();

//       this.mintingResults.errors.forEach((error) => {
//         const count = errorTypes.get(error.type) || 0;
//         errorTypes.set(error.type, count + 1);
//       });

//       errorTypes.forEach((count, type) => {
//         console.log(
//           `${type}: ${count} (${(
//             (count / this.mintingResults.errors.length) *
//             100
//           ).toFixed(2)}%)`
//         );
//       });

//       // Log detailed error samples
//       console.log("\nError Samples:");
//       const errorSamples = new Map<string, string>();
//       this.mintingResults.errors.forEach((error) => {
//         if (!errorSamples.has(error.type)) {
//           errorSamples.set(error.type, error.message);
//         }
//       });

//       errorSamples.forEach((message, type) => {
//         console.log(`\n${type} Sample Error:`);
//         console.log(message);
//       });
//     }
//   }
// }

// // Run test
// async function runTest() {
//   const stressTest = new MintStressTest();
//   const stopMonitoring = await stressTest.monitorNetwork();

//   try {
//     // Test configurations
//     const testScenarios = [
//       // { batchSize: 5, concurrentMints: 5 }, // First test
//       // { batchSize: 10, concurrentMints: 5 }, // Second test
//       { batchSize: 100, concurrentMints: 1 } // Third test
//     ];

//     for (const scenario of testScenarios) {
//       console.log(`\nRunning test scenario: ${JSON.stringify(scenario)}`);
//       await stressTest.runBatchTest(
//         scenario.batchSize,
//         scenario.concurrentMints
//       );
//       // await new Promise((resolve) => setTimeout(resolve, 5000)); // Cool down between scenarios
//     }

//     stressTest.logResults();
//   } finally {
//     stopMonitoring();
//   }
// }

// // Start test with error handling
// runTest().catch((error) => {
//   const stressTest = new MintStressTest();
//   const categorizedError = stressTest["categorizeError"](error);
//   console.error("Test failed:", categorizedError);
//   process.exit(1);
// });
