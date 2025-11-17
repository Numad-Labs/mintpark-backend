import axios from "axios";
import { firstSqueezerIndexer } from "./src/blockchain/evm/services/firstSqueezerIndexer";

const TEST_ADDRESS = "0xcf066990bf36B88A43E358d1f8c1850daDd89aCC";

async function testGraphQLDirectly() {
  console.log("=== Testing GraphQL Endpoint Directly ===");
  console.log(`Testing with address: ${TEST_ADDRESS}\n`);

  const query = `
    query GetNFTOwners($owner: String!, $contractAddress: String!) {
      nftOwners(
        where: {
          owner: $owner
          contractAddress: $contractAddress
        }
      ) {
        items {
          tokenId
          owner
          contractAddress
          chainId
          timestamp
        }
        totalCount
      }
    }
  `;

  const variables = {
    owner: TEST_ADDRESS.toLowerCase(),
    contractAddress: "0x428B878cB6383216AaDc4e8495037E8d31612621".toLowerCase()
  };

  try {
    const response = await axios.post(
      "https://ponder.juiceswap.com/graphql",
      {
        query,
        variables
      },
      {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );

    console.log("✅ GraphQL Response Status:", response.status);

    if (response.data.errors) {
      console.error("❌ GraphQL Errors:", JSON.stringify(response.data.errors, null, 2));
      return;
    }

    if (response.data.data && response.data.data.nftOwners) {
      const nftOwners = response.data.data.nftOwners;
      const nfts = nftOwners.items;
      console.log(`✅ Found ${nfts.length} First Squeezer NFTs (Total: ${nftOwners.totalCount})\n`);

      if (nfts.length > 0) {
        console.log("NFT Details:");
        nfts.forEach((nft: any, index: number) => {
          console.log(`\n  NFT #${index + 1}:`);
          console.log(`    Token ID: ${nft.tokenId}`);
          console.log(`    Owner: ${nft.owner}`);
          console.log(`    Contract: ${nft.contractAddress}`);
          console.log(`    Chain ID: ${nft.chainId}`);
          console.log(`    Timestamp: ${nft.timestamp}`);
        });
      } else {
        console.log("⚠️  No NFTs found for this address");
      }
    }
  } catch (error: any) {
    console.error("❌ Error calling GraphQL:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
  }
}

async function testIndexerService() {
  console.log("\n\n=== Testing FirstSqueezerIndexer Service ===");
  console.log(`Testing with address: ${TEST_ADDRESS}\n`);

  try {
    const tokenIds = await firstSqueezerIndexer.getOwnedTokens(TEST_ADDRESS);

    console.log(`✅ Indexer returned ${tokenIds.length} token IDs`);

    if (tokenIds.length > 0) {
      console.log("\nToken IDs:");
      tokenIds.forEach((tokenId, index) => {
        console.log(`  ${index + 1}. ${tokenId}`);
      });

      console.log("\n✅ Formatted unique indexes (as stored in DB):");
      const contractAddress = firstSqueezerIndexer.getContractAddress();
      tokenIds.forEach((tokenId, index) => {
        console.log(`  ${index + 1}. ${contractAddress}i${tokenId}`);
      });
    } else {
      console.log("⚠️  No NFTs found for this address");
    }
  } catch (error: any) {
    console.error("❌ Error in indexer service:", error.message);
  }
}

async function testContractDetection() {
  console.log("\n\n=== Testing Contract Detection ===\n");

  const testAddresses = [
    "0x428B878cB6383216AaDc4e8495037E8d31612621", // First Squeezer (should be true)
    "0x428b878cb6383216aadc4e8495037e8d31612621", // First Squeezer lowercase (should be true)
    "0x1234567890123456789012345678901234567890"  // Random address (should be false)
  ];

  testAddresses.forEach((address) => {
    const isFirstSqueezer = firstSqueezerIndexer.isFirstSqueezerContract(address);
    console.log(`${isFirstSqueezer ? "✅" : "❌"} ${address}: ${isFirstSqueezer ? "First Squeezer" : "Not First Squeezer"}`);
  });
}

// Run all tests
async function runAllTests() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║     First Squeezer NFT Indexer - Integration Test             ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  await testGraphQLDirectly();
  await testIndexerService();
  await testContractDetection();

  console.log("\n\n=== Test Complete ===\n");
}

runAllTests().catch(console.error);
