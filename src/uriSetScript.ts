import { ethers } from "ethers";
import { collectibleRepository } from "./repositories/collectibleRepository";
import NFTService from "./blockchain/evm/services/nftService";
import { db } from "./utils/db";

// Configuration - Replace these values
const RPC_URL = "https://rpc.testnet.citrea.xyz";
const PRIVATE_KEY =
  "4da5dd130e5f01601729a4d2736032ca65f7250c7d5f0856cc69a1851b80ca4b";
const CONTRACT_ADDRESS = "0x6C3729b780F447D5DF56841a7F0f9F6C409275DE";

// Contract ABI - Add only the functions you need
const contractABI = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256"
      },
      {
        internalType: "string",
        name: "_tokenURI",
        type: "string"
      }
    ],
    name: "setTokenURI",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];

// Token IDs that need updating
const tokenIds = [
  4574, 4630, 4715, 4726, 4807, 4764, 4871, 4763, 4930, 4863, 4893, 4943, 4958
];

async function processMetadata(
  tokenId: number
  // nftService: NFTService
  // collectibleRepository: CollectibleRepository,
  // db: Kysely<DB>
) {
  const uniqueIdx = `${CONTRACT_ADDRESS}i${tokenId}`;
  const collectible = await collectibleRepository.getByUniqueIdx(uniqueIdx);
  console.log("🚀 ~ collectible:", collectible);
  const nftService = new NFTService(RPC_URL);

  if (!collectible) {
    throw new Error(`No metadata found for token ${tokenId}`);
  }

  if (!collectible.fileKey) {
    throw new Error(`No file key found for token ${tokenId}`);
  }

  // Only upload to IPFS if CID is empty
  if (!collectible.cid) {
    console.log(`Uploading to IPFS for token ${tokenId}...`);

    // Upload file to IPFS
    const ipfsUrl = await nftService.uploadS3FileToIpfs(
      collectible.fileKey,
      collectible.name
    );

    // // Update the collectible with the IPFS URL
    await collectibleRepository.update(db, collectible.id, {
      cid: ipfsUrl
    });

    console.log(`Updated CID for token ${tokenId}: ${ipfsUrl}`);

    return {
      tokenURI: ipfsUrl,
      metadata: {
        ...collectible,
        cid: ipfsUrl
      }
    };
  }

  return {
    tokenURI: collectible.cid,
    metadata: collectible
  };
}

async function setTokenURIs() {
  try {
    // Initialize provider and signer
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);

    // Create contract instance
    const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);

    console.log("Starting to process tokens...");

    // Process each token ID
    for (const tokenId of tokenIds) {
      try {
        // Get metadata from database
        const { tokenURI, metadata } = await processMetadata(tokenId);
        console.log("🚀 ~ setTokenURIs ~ metadata:", metadata);

        console.log(`Setting URI for token ${tokenId}...`);
        console.log(`Token Name: ${metadata.name}`);
        console.log(`Token URI: ${tokenURI}`);

        // Prepare and send transaction
        const tx = await contract.setTokenURI(tokenId, tokenURI);

        // Wait for transaction confirmation
        const receipt = await tx.wait();

        console.log(`✓ Successfully set URI for token ${tokenId}`);
        console.log(`Transaction hash: ${receipt?.hash}`);

        // Add delay between transactions
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error processing token ${tokenId}:`, error);
        continue; // Continue with next token if one fails
      }
    }

    console.log("✓ Finished processing all tokens");
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Run the script
setTokenURIs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
