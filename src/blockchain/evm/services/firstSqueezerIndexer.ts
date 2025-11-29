import axios from "axios";
import logger from "@config/winston";

// First Squeezer NFT contract details
const FIRST_SQUEEZER_CONTRACT = "0x428B878cB6383216AaDc4e8495037E8d31612621";
const FIRST_SQUEEZER_CHAIN_ID = "5115"; // Citrea Testnet
const PONDER_GRAPHQL_URL = "https://ponder.juiceswap.com/graphql";

interface NFTOwner {
  owner: string;
  chainId: string;
  tokenId: string;
  contractAddress: string;
  timestamp: string;
}

interface NFTOwnerPage {
  items: NFTOwner[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  totalCount: number;
}

interface GraphQLResponse {
  data: {
    nftOwners: NFTOwnerPage;
  };
  errors?: any[];
}

export class FirstSqueezerIndexer {
  /**
   * Fetches First Squeezer NFTs owned by a specific wallet address
   * @param ownerAddress The wallet address to query
   * @returns Array of token IDs owned by the address
   */
  async getOwnedTokens(ownerAddress: string): Promise<string[]> {
    try {
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
          }
        }
      `;

      const variables = {
        owner: ownerAddress.toLowerCase(),
        contractAddress: FIRST_SQUEEZER_CONTRACT.toLowerCase()
      };

      logger.info(
        `Fetching First Squeezer NFTs for owner: ${ownerAddress} from custom indexer`
      );

      const response = await axios.post<GraphQLResponse>(
        PONDER_GRAPHQL_URL,
        {
          query,
          variables
        },
        {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 10000 // 10 second timeout
        }
      );

      if (response.data.errors) {
        logger.error(
          "GraphQL errors from First Squeezer indexer:",
          response.data.errors
        );
        throw new Error(
          `GraphQL errors: ${JSON.stringify(response.data.errors)}`
        );
      }

      if (!response.data.data || !response.data.data.nftOwners) {
        logger.warn(
          "No NFT owners data returned from First Squeezer indexer"
        );
        return [];
      }

      const nftOwners = response.data.data.nftOwners;
      const tokenIds = nftOwners.items.map((nft) => nft.tokenId);

      logger.info(
        `Found ${tokenIds.length} First Squeezer NFTs for owner: ${ownerAddress}`
      );

      return tokenIds;
    } catch (error: any) {
      logger.error(
        `Error fetching First Squeezer NFTs for ${ownerAddress}:`,
        error.message
      );

      // Return empty array instead of throwing to prevent blocking other collections
      // This allows the system to gracefully handle indexer failures
      return [];
    }
  }

  /**
   * Checks if a contract address is the First Squeezer NFT collection
   * @param contractAddress The contract address to check
   * @returns true if it's the First Squeezer contract
   */
  isFirstSqueezerContract(contractAddress: string): boolean {
    return (
      contractAddress.toLowerCase() === FIRST_SQUEEZER_CONTRACT.toLowerCase()
    );
  }

  /**
   * Gets the First Squeezer contract address
   */
  getContractAddress(): string {
    return FIRST_SQUEEZER_CONTRACT;
  }

  /**
   * Gets the chain ID for First Squeezer NFTs
   */
  getChainId(): string {
    return FIRST_SQUEEZER_CHAIN_ID;
  }
}

// Export singleton instance
export const firstSqueezerIndexer = new FirstSqueezerIndexer();
