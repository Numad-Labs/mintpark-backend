import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  gql
} from "@apollo/client/core";
import fetch from "cross-fetch";
import { EVM_CONFIG } from "../../evm-config";
import { Layer } from "../../../../types/db/types";
import { LAYER } from "../../../../types/db/enums";
import logger from "../../../../config/winston";

class SubgraphService {
  private clients: Map<string, ApolloClient<any>> = new Map();

  constructor() {
    this.initializeClients();
  }

  private initializeClients() {
    // Initialize Apollo clients for each chain that has a SUBGRAPH_URL defined
    Object.entries(EVM_CONFIG.CHAINS).forEach(([chainIdStr, chainConfig]) => {
      if (!chainConfig.SUBGRAPH_URL) {
        return;
      }

      // Get layer from your layer repository or mapping based on chainId
      const layer = this.getLayerByChainId(parseInt(chainIdStr));

      if (!layer) {
        return;
      }

      const client = new ApolloClient({
        link: new HttpLink({ uri: chainConfig.SUBGRAPH_URL, fetch }),
        cache: new InMemoryCache()
      });

      const clientKey = `${layer}-${chainIdStr}`;
      this.clients.set(clientKey, client);
      logger.info(
        `Initialized subgraph client for ${layer} (${chainIdStr}): ${chainConfig.SUBGRAPH_URL}`
      );
    });

    logger.info(`Initialized ${this.clients.size} subgraph clients`);
  }

  /**
   * Map chainId to Layer - implement based on your application's mapping
   * This is a placeholder - replace with your actual mapping logic
   */
  private getLayerByChainId(chainId: number) {
    const chainToLayerMap: Record<number, string> = {
      43111: LAYER.HEMI,
      743111: LAYER.HEMI,
      5115: LAYER.CITREA
    };
    return chainToLayerMap[chainId] || null;
  }

  /**
   * Query marketplace events for a specific user
   */
  async queryUserMarketplaceActivity(
    userAddress: string,
    limit: number = 100
  ): Promise<any[]> {
    const allResults: any[] = [];
    const queryPromises = Array.from(this.clients.entries()).map(
      async ([key, client]) => {
        try {
          const result = await client.query({
            query: gql`
              query GetUserMarketActivity($userAddress: String!, $limit: Int!) {
                listings(first: $limit, where: { from: $userAddress }) {
                  id
                  token {
                    id
                    tokenId
                    collection {
                      id
                      name
                    }
                  }
                  price
                  currency
                  createdAt
                  status
                }
                purchases(first: $limit, where: { buyer: $userAddress }) {
                  id
                  token {
                    id
                    tokenId
                    collection {
                      id
                      name
                    }
                  }
                  price
                  currency
                  timestamp
                }
              }
            `,
            variables: { userAddress: userAddress.toLowerCase(), limit }
          });

          // Add chain info to each result
          const [layer, chainId] = key.split("-");
          const listings = (result.data.listings || []).map((listing: any) => ({
            ...listing,
            type: "listing",
            layer,
            chainId: parseInt(chainId)
          }));

          const purchases = (result.data.purchases || []).map(
            (purchase: any) => ({
              ...purchase,
              type: "purchase",
              layer,
              chainId: parseInt(chainId)
            })
          );

          allResults.push(...listings, ...purchases);
        } catch (error) {
          logger.error(
            `Error querying market activity for user ${userAddress} from ${key}:`,
            error
          );
        }
      }
    );

    await Promise.all(queryPromises);
    return allResults;
  }

  /**
   * Get subgraph status/health check
   */
  async getSubgraphStatus(): Promise<any[]> {
    const statuses = [];

    for (const [key, client] of this.clients.entries()) {
      const [layer, chainId] = key.split("-");

      try {
        // Query the subgraph _meta field to check sync status
        const result = await client.query({
          query: gql`
            query GetSubgraphMeta {
              _meta {
                hasIndexingErrors
                block {
                  number
                  hash
                }
                deployment
              }
            }
          `
        });

        statuses.push({
          layer,
          chainId: parseInt(chainId),
          status: "online",
          latestBlock: result.data._meta.block.number,
          hasErrors: result.data._meta.hasIndexingErrors,
          deployment: result.data._meta.deployment
        });
      } catch (error) {
        statuses.push({
          layer,
          chainId: parseInt(chainId),
          status: "offline",
          error: error
        });

        logger.error(
          `Subgraph for ${layer} (${chainId}) is not responding:`,
          error
        );
      }
    }

    return statuses;
  }

  /**
   * Get overall marketplace activity including listings, sales, and cancellations
   * @param layer - The blockchain layer (e.g., HEMI, CITREA)
   * @param chainId - The chain ID
   * @param limit - Maximum number of activities to return (default: 20)
   * @param offset - Number of activities to skip (default: 0)
   * @param sortBy - Field to sort by (default: blockTimestamp)
   * @param sortDirection - Sort direction (default: desc)
   * @param activityTypes - Filter for activity type
   * @returns Object containing marketplace activities
   */
  async getMarketplaceActivity(
    layer: string,
    chainId: number,
    {
      limit = 20,
      offset = 0,
      sortBy = "blockTimestamp",
      sortDirection = "desc",
      activityTypes = ["CREATED", "SOLD", "CANCELLED"]
    }: {
      limit?: number;
      offset?: number;
      sortBy?: string;
      sortDirection?: "asc" | "desc";
      activityTypes?: string[];
    } = {}
  ) {
    const clientKey = `${layer}-${chainId}`;
    const client = this.clients.get(clientKey);

    if (!client) {
      logger.error(`No subgraph client found for ${layer} (${chainId})`);
      throw new Error(`No subgraph client found for ${layer} (${chainId})`);
    }

    try {
      // Define GraphQL queries
      const createdListingsQuery = gql`
        query GetCreatedListings(
          $limit: Int!
          $offset: Int!
          $orderBy: String!
          $orderDirection: String!
        ) {
          listingCreateds(
            first: $limit
            skip: $offset
            orderBy: $orderBy
            orderDirection: $orderDirection
          ) {
            id
            listingId
            nftContract
            tokenId
            price
            blockNumber
            blockTimestamp
            transactionHash
          }
        }
      `;

      const soldListingsQuery = gql`
        query GetSoldListings(
          $limit: Int!
          $offset: Int!
          $orderBy: String!
          $orderDirection: String!
        ) {
          listingSolds(
            first: $limit
            skip: $offset
            orderBy: $orderBy
            orderDirection: $orderDirection
          ) {
            id
            listingId
            buyer
            price
            blockNumber
            blockTimestamp
            transactionHash
          }
        }
      `;

      const cancelledListingsQuery = gql`
        query GetCancelledListings(
          $limit: Int!
          $offset: Int!
          $orderBy: String!
          $orderDirection: String!
        ) {
          listingCancelleds(
            first: $limit
            skip: $offset
            orderBy: $orderBy
            orderDirection: $orderDirection
          ) {
            id
            listingId
            blockNumber
            blockTimestamp
            transactionHash
          }
        }
      `;

      // Build query promises
      const queryPromises: { type: string; promise: Promise<any> }[] = [];

      if (activityTypes.includes("CREATED")) {
        queryPromises.push({
          type: "CREATED",
          promise: client.query({
            query: createdListingsQuery,
            variables: {
              limit,
              offset,
              orderBy: sortBy,
              orderDirection: sortDirection
            }
          })
        });
      }

      if (activityTypes.includes("SOLD")) {
        queryPromises.push({
          type: "SOLD",
          promise: client.query({
            query: soldListingsQuery,
            variables: {
              limit,
              offset,
              orderBy: sortBy,
              orderDirection: sortDirection
            }
          })
        });
      }

      if (activityTypes.includes("CANCELLED")) {
        queryPromises.push({
          type: "CANCELLED",
          promise: client.query({
            query: cancelledListingsQuery,
            variables: {
              limit,
              offset,
              orderBy: sortBy,
              orderDirection: sortDirection
            }
          })
        });
      }

      // Run all queries in parallel
      const responses = await Promise.all(queryPromises.map((q) => q.promise));

      // Process results
      const allActivities: any[] = [];

      queryPromises.forEach(({ type }, index) => {
        const data = responses[index].data;

        if (type === "CREATED") {
          const listings = data.listingCreateds.map((item: any) => ({
            ...item,
            type: "CREATED",
            timestamp: parseInt(item.blockTimestamp)
          }));
          allActivities.push(...listings);
        }

        if (type === "SOLD") {
          const listings = data.listingSolds.map((item: any) => ({
            ...item,
            type: "SOLD",
            timestamp: parseInt(item.blockTimestamp)
          }));
          allActivities.push(...listings);
        }

        if (type === "CANCELLED") {
          const listings = data.listingCancelleds.map((item: any) => ({
            ...item,
            type: "CANCELLED",
            timestamp: parseInt(item.blockTimestamp)
          }));
          allActivities.push(...listings);
        }
      });

      // Sort all activities by timestamp
      const sortedActivities = allActivities.sort((a, b) =>
        sortDirection === "desc"
          ? b.timestamp - a.timestamp
          : a.timestamp - b.timestamp
      );

      // Paginate the merged list
      const paginatedActivities = sortedActivities.slice(0, limit);

      return {
        activities: paginatedActivities,
        total: allActivities.length,
        limit,
        offset
      };
    } catch (error) {
      logger.error(
        `Error fetching marketplace activity for ${layer} (${chainId}): ${error}`
      );
      throw new Error(`Error fetching marketplace activity: ${error}`);
    }
  }

  /**
   * Get listing information by listingId
   * @param layer - The blockchain layer (HEMI, CITREA, etc.)
   * @param chainId - The chain ID
   * @param listingId - The ID of the listing to fetch
   * @returns Listing information or null if not found
   */
  async getListingById(
    layer: (typeof LAYER)[keyof typeof LAYER],
    chainId: number,
    listingId: string
  ) {
    const clientKey = `${layer}-${chainId}`;
    const client = this.clients.get(clientKey);

    if (!client) {
      logger.error(`No subgraph client found for ${layer} (${chainId})`);
      throw new Error(`No subgraph client found for ${layer} (${chainId})`);
    }

    try {
      // Query for listing created events with the specified listingId
      const listingQuery = gql`
        query GetListingById($listingId: String!) {
          listingCreateds(where: { listingId: $listingId }) {
            id
            listingId
            nftContract
            tokenId
            price
            blockNumber
            blockTimestamp
            transactionHash
          }
          listingSolds(where: { listingId: $listingId }) {
            id
            listingId
            buyer
            price
            blockNumber
            blockTimestamp
            transactionHash
          }
          listingCancelleds(where: { listingId: $listingId }) {
            id
            listingId
            blockNumber
            blockTimestamp
            transactionHash
          }
        }
      `;

      const { data } = await client.query({
        query: listingQuery,
        variables: {
          listingId
        }
      });

      // Check if listing exists
      if (!data.listingCreateds || data.listingCreateds.length === 0) {
        return null;
      }

      // Get the created listing event (should be only one per listingId)
      const listingCreated = data.listingCreateds[0];

      // Get all sales and cancellations for this listing
      const sales = data.listingSolds || [];
      const cancellations = data.listingCancelleds || [];

      // Sort sales by timestamp (newest first)
      const sortedSales = [...sales].sort(
        (a, b) => parseInt(b.blockTimestamp) - parseInt(a.blockTimestamp)
      );

      // Sort cancellations by timestamp (newest first)
      const sortedCancellations = [...cancellations].sort(
        (a, b) => parseInt(b.blockTimestamp) - parseInt(a.blockTimestamp)
      );

      // Get latest sale and cancellation if they exist
      const latestSale = sortedSales.length > 0 ? sortedSales[0] : null;
      const latestCancellation =
        sortedCancellations.length > 0 ? sortedCancellations[0] : null;

      // Determine current status of the listing
      let status = "ACTIVE";

      // If there have been sales or cancellations, determine the latest action
      if (latestSale || latestCancellation) {
        if (!latestSale) {
          status = "CANCELLED";
        } else if (!latestCancellation) {
          status = "SOLD";
        } else {
          // Compare timestamps to determine which happened most recently
          const saleTimestamp = parseInt(latestSale.blockTimestamp);
          const cancelTimestamp = parseInt(latestCancellation.blockTimestamp);
          status = saleTimestamp > cancelTimestamp ? "SOLD" : "CANCELLED";
        }
      }

      return {
        id: listingCreated.id,
        listingId: listingCreated.listingId,
        nftContract: listingCreated.nftContract,
        tokenId: listingCreated.tokenId,
        price: listingCreated.price,
        blockNumber: listingCreated.blockNumber,
        blockTimestamp: parseInt(listingCreated.blockTimestamp),
        transactionHash: listingCreated.transactionHash,
        status,
        buyer: latestSale ? latestSale.buyer : null,
        soldTimestamp: latestSale ? parseInt(latestSale.blockTimestamp) : null,
        cancelledTimestamp: latestCancellation
          ? parseInt(latestCancellation.blockTimestamp)
          : null,
        salesHistory: sortedSales.map((sale) => ({
          buyer: sale.buyer,
          price: sale.price,
          timestamp: parseInt(sale.blockTimestamp),
          transactionHash: sale.transactionHash
        })),
        totalSales: sales.length
      };
    } catch (error) {
      logger.error(
        `Error fetching listing by ID for ${layer} (${chainId}): ${error}`
      );
      throw new Error(`Error fetching listing by ID: ${error}`);
    }
  }

  /**
   * Get all activities for a specific NFT (by contract address and token ID)
   * @param layer - The blockchain layer (currently only HEMI is supported)
   * @param chainId - The chain ID
   * @param nftContract - The NFT contract address
   * @param tokenId - The token ID
   * @param limit - Maximum number of activities to return (default: 20)
   * @param offset - Number of activities to skip (default: 0)
   * @param sortBy - Field to sort by (default: blockTimestamp)
   * @param sortDirection - Sort direction (default: desc)
   * @returns Object containing token activities
   */
  async getTokenActivity(
    layer: (typeof LAYER)[keyof typeof LAYER],
    chainId: number,
    nftContract: string,
    tokenId: string,
    {
      limit = 20,
      offset = 0,
      sortBy = "blockTimestamp",
      sortDirection = "desc"
    }: {
      limit?: number;
      offset?: number;
      sortBy?: string;
      sortDirection?: "asc" | "desc";
    } = {}
  ) {
    const clientKey = `${layer}-${chainId}`;
    const client = this.clients.get(clientKey);

    if (!client) {
      logger.error(`No subgraph client found for ${layer} (${chainId})`);
      throw new Error(`No subgraph client found for ${layer} (${chainId})`);
    }

    try {
      // Query for listing created events for the token
      // Include transaction.from to get seller information
      const createdListingsQuery = gql`
        query GetTokenListingCreateds(
          $nftContract: String!
          $tokenId: String!
        ) {
          listingCreateds(
            where: { nftContract: $nftContract, tokenId: $tokenId }
            first: 1000
          ) {
            id
            listingId
            nftContract
            tokenId
            price
            blockNumber
            blockTimestamp
            transactionHash
            from
          }
        }
      `;

      // First fetch all created listings for this token
      const createdListingsRes = await client.query({
        query: createdListingsQuery,
        variables: {
          nftContract,
          tokenId
        }
      });

      // Extract all listingIds for this token
      const listingIds = createdListingsRes.data.listingCreateds.map(
        (listing: any) => listing.listingId
      );

      // If no listings found, return empty result
      if (listingIds.length === 0) {
        return {
          activities: [],
          total: 0,
          limit,
          offset,
          nftContract,
          tokenId
        };
      }

      // Create a map of listing IDs to seller addresses
      const listingSellerMap = new Map();
      createdListingsRes.data.listingCreateds.forEach((listing: any) => {
        listingSellerMap.set(listing.listingId, listing.from || "Unknown");
      });

      // Query for listing sold events that match the specific listingIds
      const soldListingsQuery = gql`
        query GetListingSolds($listingIds: [String!]) {
          listingSolds(where: { listingId_in: $listingIds }, first: 1000) {
            id
            listingId
            buyer
            price
            blockNumber
            blockTimestamp
            transactionHash
          }
        }
      `;

      // Query for listing cancelled events that match the specific listingIds
      const cancelledListingsQuery = gql`
        query GetListingCancelleds($listingIds: [String!]) {
          listingCancelleds(where: { listingId_in: $listingIds }, first: 1000) {
            id
            listingId
            blockNumber
            blockTimestamp
            transactionHash
          }
        }
      `;

      // Execute the remaining queries in parallel
      const [soldListingsRes, cancelledListingsRes] = await Promise.all([
        client.query({
          query: soldListingsQuery,
          variables: {
            listingIds
          }
        }),
        client.query({
          query: cancelledListingsQuery,
          variables: {
            listingIds
          }
        })
      ]);

      // Process created listings for the token, including seller information
      const createdListings = createdListingsRes.data.listingCreateds.map(
        (listing: any) => ({
          ...listing,
          seller: listing.transaction?.from || "Unknown", // Add seller from transaction
          type: "CREATED",
          timestamp: parseInt(listing.blockTimestamp)
        })
      );

      // Process sold listings - add seller information from our map
      const soldListings = soldListingsRes.data.listingSolds.map(
        (listing: any) => ({
          ...listing,
          seller: listingSellerMap.get(listing.listingId) || "Unknown",
          type: "SOLD",
          timestamp: parseInt(listing.blockTimestamp)
        })
      );

      // Process cancelled listings - add seller information from our map
      const cancelledListings = cancelledListingsRes.data.listingCancelleds.map(
        (listing: any) => ({
          ...listing,
          seller: listingSellerMap.get(listing.listingId) || "Unknown",
          type: "CANCELLED",
          timestamp: parseInt(listing.blockTimestamp)
        })
      );

      // Combine all activities
      const allActivities = [
        ...createdListings,
        ...soldListings,
        ...cancelledListings
      ];

      // Sort by timestamp
      const sortedActivities = allActivities.sort((a, b) => {
        if (sortDirection === "desc") {
          return b.timestamp - a.timestamp;
        }
        return a.timestamp - b.timestamp;
      });

      // Apply pagination
      const paginatedActivities = sortedActivities.slice(
        offset,
        offset + limit
      );

      // Count the total number of unique listings and transactions
      const uniqueListingIds = new Set(
        allActivities.map((activity: any) => activity.listingId)
      ).size;
      const uniqueTransactions = new Set(
        allActivities.map((activity: any) => activity.transactionHash)
      ).size;

      return {
        activities: paginatedActivities,
        total: allActivities.length,
        uniqueListings: uniqueListingIds,
        uniqueTransactions: uniqueTransactions,
        limit,
        offset,
        nftContract,
        tokenId
      };
    } catch (error) {
      logger.error(
        `Error fetching token activity for ${layer} (${chainId}): ${error}`
      );
      throw new Error(`Error fetching token activity: ${error}`);
    }
  }

  /**
   * Get all activities for a specific NFT collection (by contract address)
   * @param layer - The blockchain layer (e.g., HEMI, CITREA)
   * @param chainId - The chain ID
   * @param collectionAddress - The NFT collection contract address
   * @param limit - Maximum number of activities to return (default: 20)
   * @param offset - Number of activities to skip (default: 0)
   * @param sortBy - Field to sort by (default: blockTimestamp)
   * @param sortDirection - Sort direction (default: desc)
   * @returns Object containing collection activities formatted with required fields
   */
  async getCollectionActivity(
    layer: (typeof LAYER)[keyof typeof LAYER],
    chainId: number,
    collectionAddress: string,
    {
      limit = 20,
      offset = 0,
      sortBy = "blockTimestamp",
      sortDirection = "desc",
      activityTypes = ["CREATED", "SOLD", "CANCELLED"]
    }: {
      limit?: number;
      offset?: number;
      sortBy?: string;
      sortDirection?: "asc" | "desc";
      activityTypes?: string[];
    } = {}
  ) {
    const clientKey = `${layer}-${chainId}`;
    const client = this.clients.get(clientKey);

    if (!client) {
      logger.error(`No subgraph client found for ${layer} (${chainId})`);
      throw new Error(`No subgraph client found for ${layer} (${chainId})`);
    }

    try {
      // Get all listingCreateds for the collection
      const allCreatedListingsQuery = gql`
        query GetAllCollectionListings($collectionAddress: String!) {
          listingCreateds(
            where: { nftContract: $collectionAddress }
            first: 1000
          ) {
            listingId
            tokenId
            nftContract
            from
            price
            blockNumber
            blockTimestamp
            transactionHash
          }
        }
      `;

      const allCreatedListingsRes = await client.query({
        query: allCreatedListingsQuery,
        variables: {
          collectionAddress
        }
      });

      const collectionListingIds =
        allCreatedListingsRes.data.listingCreateds.map(
          (listing: any) => listing.listingId
        );

      if (collectionListingIds.length === 0) {
        return {
          activities: [],
          total: 0,
          uniqueTokens: 0,
          limit,
          offset,
          collectionAddress
        };
      }

      const createdListingsMap = new Map();
      allCreatedListingsRes.data.listingCreateds.forEach((listing: any) => {
        createdListingsMap.set(listing.listingId, {
          tokenId: listing.tokenId,
          nftContract: listing.nftContract,
          seller: listing.from || "Unknown",
          price: listing.price,
          blockNumber: listing.blockNumber,
          blockTimestamp: listing.blockTimestamp,
          transactionHash: listing.transactionHash
        });
      });

      // Parallel fetches for SOLD and CANCELLED
      const queryPromises: Promise<any>[] = [];

      if (activityTypes.includes("SOLD")) {
        const soldListingsQuery = gql`
          query GetCollectionListingSolds($listingIds: [String!]) {
            listingSolds(where: { listingId_in: $listingIds }, first: 1000) {
              id
              listingId
              buyer
              price
              blockNumber
              blockTimestamp
              transactionHash
            }
          }
        `;
        queryPromises.push(
          client.query({
            query: soldListingsQuery,
            variables: {
              listingIds: collectionListingIds
            }
          })
        );
      } else {
        queryPromises.push(Promise.resolve({ data: { listingSolds: [] } }));
      }

      if (activityTypes.includes("CANCELLED")) {
        const cancelledListingsQuery = gql`
          query GetCollectionListingCancelleds($listingIds: [String!]) {
            listingCancelleds(
              where: { listingId_in: $listingIds }
              first: 1000
            ) {
              id
              listingId
              blockNumber
              blockTimestamp
              transactionHash
            }
          }
        `;
        queryPromises.push(
          client.query({
            query: cancelledListingsQuery,
            variables: {
              listingIds: collectionListingIds
            }
          })
        );
      } else {
        queryPromises.push(
          Promise.resolve({ data: { listingCancelleds: [] } })
        );
      }

      const [soldListingsRes, cancelledListingsRes] =
        await Promise.all(queryPromises);

      const activities: any[] = [];

      if (activityTypes.includes("CREATED")) {
        const createdListings = allCreatedListingsRes.data.listingCreateds.map(
          (listing: any) => ({
            item: {
              tokenId: listing.tokenId,
              contractAddress: listing.nftContract
            },
            event: "CREATED",
            price: listing.price,
            from: listing.from || "Unknown",
            to: null,
            time: parseInt(listing.blockTimestamp),
            listingId: listing.listingId,
            transactionHash: listing.transactionHash
          })
        );
        activities.push(...createdListings);
      }

      if (activityTypes.includes("SOLD")) {
        const soldListings = soldListingsRes.data.listingSolds.map(
          (listing: any) => {
            const created = createdListingsMap.get(listing.listingId);
            return {
              item: {
                tokenId: created?.tokenId || "Unknown",
                contractAddress: collectionAddress
              },
              event: "SOLD",
              price: listing.price,
              from: created?.seller || "Unknown",
              to: listing.buyer,
              time: parseInt(listing.blockTimestamp),
              listingId: listing.listingId,
              transactionHash: listing.transactionHash
            };
          }
        );
        activities.push(...soldListings);
      }

      if (activityTypes.includes("CANCELLED")) {
        const cancelledListings =
          cancelledListingsRes.data.listingCancelleds.map((listing: any) => {
            const created = createdListingsMap.get(listing.listingId);
            return {
              item: {
                tokenId: created?.tokenId || "Unknown",
                contractAddress: collectionAddress
              },
              event: "CANCELLED",
              price: null,
              from: created?.seller || "Unknown",
              to: null,
              time: parseInt(listing.blockTimestamp),
              listingId: listing.listingId,
              transactionHash: listing.transactionHash
            };
          });
        activities.push(...cancelledListings);
      }

      const sorted = activities.sort((a, b) =>
        sortDirection === "desc" ? b.time - a.time : a.time - b.time
      );

      const paginated = sorted.slice(offset, offset + limit);

      return {
        activities: paginated,
        total: activities.length,
        uniqueTokens: new Set(activities.map((a: any) => a.item.tokenId)).size,
        limit,
        offset,
        collectionAddress
      };
    } catch (error) {
      logger.error(
        `Error fetching collection activity for ${layer} (${chainId}): ${error}`
      );
      throw new Error(`Error fetching collection activity: ${error}`);
    }
  }
}
export default SubgraphService;
