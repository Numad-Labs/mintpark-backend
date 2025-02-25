// import { ethers } from "ethers";
// import { launchItemRepository } from "./repositories/launchItemRepository";

// interface ReconciliationProgress {
//   totalNFTs: number;
//   processedNFTs: number;
//   percentage: number;
// }

// interface NftItem {
//   nftId: string;
//   collectibleId: string;
//   status: string;
// }

// interface NftDiscrepancy {
//   tokenId: string;
//   owner: string;
//   status: "missing_from_db" | "missing_on_chain" | "wrong_owner";
// }

// interface ReconciliationResult {
//   totalOnChain: number;
//   totalInDB: number;
//   discrepancies: NftDiscrepancy[];
//   discrepancyCount: number;
//   processedAt: string;
// }

// type ProgressCallback = (progress: ReconciliationProgress) => void;

// // Helper function to process a single token with retries
// async function processToken(
//   contract: ethers.Contract,
//   index: number,
//   retryCount = 3,
//   retryDelay = 2000
// ): Promise<{ tokenId: string; owner: string } | null> {
//   for (let attempt = 0; attempt < retryCount; attempt++) {
//     try {
//       const tokenId = await contract.tokenByIndex(index);
//       // Add small delay between calls
//       await new Promise((resolve) => setTimeout(resolve, 100));
//       const owner = await contract.ownerOf(tokenId);
//       return { tokenId: tokenId.toString(), owner };
//     } catch (error: any) {
//       if (attempt === retryCount - 1) {
//         console.error(
//           `Failed to process token at index ${index} after ${retryCount} attempts:`,
//           error.message
//         );
//         return null;
//       }
//       // Wait before retry
//       await new Promise((resolve) => setTimeout(resolve, retryDelay));
//     }
//   }
//   return null;
// }

// async function reconcileNFTState(
//   launchId: string,
//   contractAddress: string,
//   onProgress?: ProgressCallback
// ): Promise<ReconciliationResult> {
//   console.log(`Starting NFT reconciliation for launch ID: ${launchId}`);
//   console.log(`Contract address: ${contractAddress}`);

//   try {
//     // Initialize provider with higher timeout
//     const provider = new ethers.JsonRpcProvider(
//       "https://rpc.testnet.citrea.xyz",
//       undefined,
//       {
//         // timeout: 30000, // 30 seconds timeout
//         staticNetwork: true
//       }
//     );

//     const contract = new ethers.Contract(
//       contractAddress,
//       [
//         "function totalSupply() view returns (uint256)",
//         "function ownerOf(uint256) view returns (address)",
//         "function tokenByIndex(uint256) view returns (uint256)"
//       ],
//       provider
//     );

//     // Get all database NFTs
//     console.log("Fetching NFTs from database...");
//     const dbNftItems =
//       await launchItemRepository.getActiveLaunchItemsWithCollectibleId(
//         launchId
//       );
//     console.log(`Retrieved ${dbNftItems.length} NFTs from database`);

//     // Create lookup maps for efficient comparison
//     const dbNftMap = new Map(dbNftItems.map((item) => [item.nftId, item]));
//     const onChainNfts = new Map<string, string>(); // tokenId -> owner
//     const discrepancies: NftDiscrepancy[] = [];

//     // Get total supply from contract with retries
//     console.log("Fetching total supply from contract...");
//     let totalSupply: number = 5000; // Default fallback
//     for (let attempt = 0; attempt < 3; attempt++) {
//       try {
//         totalSupply = Number(await contract.totalSupply());
//         console.log(`Total NFT supply on chain: ${totalSupply}`);
//         break;
//       } catch (error) {
//         console.error(
//           `Attempt ${attempt + 1} to get total supply failed:`,
//           error
//         );
//         if (attempt === 2) {
//           console.warn("Using fallback total supply value:", totalSupply);
//         } else {
//           await new Promise((resolve) => setTimeout(resolve, 2000));
//         }
//       }
//     }

//     // Process NFTs in smaller batches with longer delays
//     const batchSize = 40; // Reduced batch size
//     const delayBetweenBatches = 2000; // 2 second delay between batches

//     for (let i = 0; i < totalSupply; i += batchSize) {
//       const batchPromises = [];
//       const end = Math.min(i + batchSize, totalSupply);

//       for (let j = i; j < end; j++) {
//         // Process each token with retries
//         batchPromises.push(processToken(contract, j));
//       }

//       // Wait for batch to complete
//       const results = await Promise.all(batchPromises);

//       // Process successful results
//       results.forEach((result) => {
//         if (result) {
//           onChainNfts.set(result.tokenId, result.owner);
//         }
//       });

//       // Update progress
//       if (onProgress) {
//         onProgress({
//           totalNFTs: totalSupply,
//           processedNFTs: Math.min(i + batchSize, totalSupply),
//           percentage: Math.round(((i + batchSize) / totalSupply) * 100)
//         });
//       }

//       // Add delay between batches
//       await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
//     }

//     // Find discrepancies
//     console.log("\nAnalyzing discrepancies...");

//     // Check for NFTs on chain but not in DB
//     for (const [tokenId, owner] of onChainNfts.entries()) {
//       if (!dbNftMap.has(tokenId)) {
//         discrepancies.push({
//           tokenId,
//           owner,
//           status: "missing_from_db"
//         });
//       }
//     }

//     // Check for NFTs in DB but not on chain
//     for (const [tokenId, dbItem] of dbNftMap.entries()) {
//       if (!onChainNfts.has(tokenId)) {
//         discrepancies.push({
//           tokenId,
//           owner: "",
//           status: "missing_on_chain"
//         });
//       }
//     }

//     const result: ReconciliationResult = {
//       totalOnChain: onChainNfts.size,
//       totalInDB: dbNftMap.size,
//       discrepancies,
//       discrepancyCount: discrepancies.length,
//       processedAt: new Date().toISOString()
//     };

//     // Print detailed results
//     console.log("\nReconciliation Summary:");
//     console.log(`Total NFTs on chain: ${result.totalOnChain}`);
//     console.log(`Total NFTs in database: ${result.totalInDB}`);
//     console.log(`Total discrepancies found: ${result.discrepancyCount}`);

//     if (discrepancies.length > 0) {
//       console.log("\nDiscrepancies Details:");
//       const missingFromDb = discrepancies.filter(
//         (d) => d.status === "missing_from_db"
//       );

//       if (missingFromDb.length > 0) {
//         console.log("missingFromDb.length", missingFromDb.length);
//         console.log("\nNFTs found on chain but missing from database:");
//         // missingFromDb.forEach((d) => {
//         //   console.log(`Token ID: ${d.tokenId}`);
//         //   // console.log(`Owner: ${d.owner}`);
//         //   console.log("---");
//         // });
//       }
//     }

//     return result;
//   } catch (error) {
//     console.error("Fatal error during NFT reconciliation:", error);
//     throw error;
//   }
// }

// // Main execution function
// async function main() {
//   const launchId = "0f1455e1-a5b0-4177-970c-e8f58f3a01f7";
//   const contractAddress = "0x6C3729b780F447D5DF56841a7F0f9F6C409275DE";

//   try {
//     const progressTracker = (progress: ReconciliationProgress) => {
//       console.log(
//         `Progress: ${progress.processedNFTs}/${progress.totalNFTs} ` +
//           `(${progress.percentage}%)`
//       );
//     };

//     await reconcileNFTState(launchId, contractAddress, progressTracker);
//   } catch (error) {
//     console.error("Error in main execution:", error);
//     process.exit(1);
//   }
// }

// // Execute the script
// if (require.main === module) {
//   main().catch(console.error);
// }

// export { reconcileNFTState };
