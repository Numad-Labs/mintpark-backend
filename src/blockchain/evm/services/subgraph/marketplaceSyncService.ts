// src/blockchain/subgraph/services/marketplaceSyncService.ts

import { Kysely } from "kysely";
import { DB } from "../../../../types/db/types";
import SubgraphService from "./subgraphService";
import { LAYER, LIST_STATUS, NETWORK } from "../../../../types/db/enums";
import logger from "../../../../config/winston";
import { EVM_CONFIG } from "blockchain/evm/evm-config";
import { CustomError } from "exceptions/CustomError";
import { listRepository } from "repositories/listRepository";

export class MarketplaceSyncService {
  private db: Kysely<DB>;
  private subgraphService: typeof SubgraphService;

  constructor(db: Kysely<DB>, subgraphService: typeof SubgraphService) {
    this.db = db;
    this.subgraphService = subgraphService;
  }

  /**
   * Get array of supported chain configurations with subgraph URLs
   * @returns Array of {chainId, layer, network} objects for supported chains
   */
  private async getSupportedChains() {
    // Get all layers from the database
    const layers = await this.db
      .selectFrom("Layer")
      .select(["id", "layer", "network", "chainId"])
      .execute();

    // Filter to only include chains that have subgraph URLs in EVM_CONFIG
    const supportedChains = layers.filter((layer) => {
      if (layer.chainId) {
        const chainConfig = EVM_CONFIG.CHAINS[layer.chainId];

        return chainConfig && chainConfig.SUBGRAPH_URL;
      }
    });

    logger.info(
      `Found ${supportedChains.length} supported chains with subgraphs`
    );
    return supportedChains;
  }

  /**
   * Check all listings in the database against on-chain state
   * Reconcile any discrepancies between on-chain and database states
   * Now processes all supported chains
   */
  async syncAllListings() {
    logger.info("Starting comprehensive listing status sync for all chains");

    try {
      // Get all supported chains
      const supportedChains = await this.getSupportedChains();
      console.log(
        "🚀 ~ MarketplaceSyncService ~ syncAllListings ~ supportedChains:",
        supportedChains
      );

      if (supportedChains.length === 0) {
        logger.warn("No supported chains found with subgraphs, skipping sync");
        return;
      }

      // Process each supported chain
      for (const chainInfo of supportedChains) {
        if (chainInfo.chainId) {
          await this.syncListingsForChain(
            chainInfo.layer,
            chainInfo.network,
            parseInt(chainInfo.chainId)
          );
        }
      }

      logger.info("Completed listing status sync for all chains");
    } catch (error) {
      logger.error(`Error during multi-chain listing status sync: ${error}`);
      throw error;
    }
  }

  /**
   * Checks and syncs a specific listing with on-chain state
   * @param listingId - The ID of the listing to check and sync
   * @returns Object containing the on-chain status, database status and whether the listing was updated
   */
  async checkAndSyncListing(listingId: string): Promise<{
    onChainStatus: string | null;
    dbStatus: string;
    updated: boolean;
  }> {
    try {
      // Get listing details with chain info
      const listing = await listRepository.getListingWithChainInfo(
        this.db,
        listingId
      );

      if (!listing) {
        return {
          onChainStatus: null,
          dbStatus: "NOT_FOUND",
          updated: false
        };
      }

      const layer = listing.layer as (typeof LAYER)[keyof typeof LAYER];

      // If chainId is null, return early with a default response
      if (!listing.chainId) {
        return {
          onChainStatus: null,
          dbStatus: listing.dbStatus,
          updated: false
        };
      }

      const chainId = parseInt(listing.chainId);
      const expectedListingId = listing.privateKey;

      if (!expectedListingId) {
        return {
          onChainStatus: null,
          dbStatus: listing.dbStatus,
          updated: false
        };
      }

      // Check on-chain status
      const onChainListing = await this.subgraphService.getListingById(
        layer,
        chainId,
        expectedListingId
      );

      // If not found on-chain
      if (!onChainListing) {
        return {
          onChainStatus: null,
          dbStatus: listing.dbStatus,
          updated: false
        };
      }

      // Check if we need to update status
      const needsUpdate =
        (listing.dbStatus === LIST_STATUS.ACTIVE &&
          onChainListing.status !== "ACTIVE") ||
        (listing.dbStatus === LIST_STATUS.PENDING &&
          onChainListing.status !== "PENDING");

      if (needsUpdate) {
        // Update based on on-chain status
        if (onChainListing.status === "SOLD") {
          await listRepository.updateListingStatus(
            this.db,
            listingId,
            LIST_STATUS.SOLD,
            {
              soldTxid: onChainListing.transactionHash

              // buyerId: onChainListing.buyer || null
            }
          );
        } else if (onChainListing.status === "CANCELLED") {
          await listRepository.updateListingStatus(
            this.db,
            listingId,
            LIST_STATUS.CANCELLED
          );
        } else if (
          onChainListing.status === "ACTIVE" &&
          listing.dbStatus === LIST_STATUS.PENDING
        ) {
          await listRepository.updateListingStatus(
            this.db,
            listingId,
            LIST_STATUS.ACTIVE,
            {
              price: onChainListing.price
            }
          );
        }

        return {
          onChainStatus: onChainListing.status,
          dbStatus: listing.dbStatus,
          updated: true
        };
      }

      return {
        onChainStatus: onChainListing.status,
        dbStatus: listing.dbStatus,
        updated: false
      };
    } catch (error) {
      logger.error(`Error checking listing ${listingId}: ${error}`);
      throw error;
    }
  }

  // Add these helper functions to the MarketplaceSyncService class

  /**
   * Simple delay function with logging
   * @param ms Milliseconds to delay
   * @param reason Human-readable reason for the delay
   */
  private async delay(ms: number, reason: string): Promise<void> {
    // logger.info(`Pausing for ${ms / 1000} seconds: ${reason}`);
    await new Promise((resolve) => setTimeout(resolve, ms));
    // logger.info(`Resuming after ${ms / 1000} second pause`);
  }

  /**
   * Safe request to subgraph with detailed logging
   * @param layer The blockchain layer
   * @param chainId Chain ID
   * @param listingId Listing ID to fetch
   * @returns The listing data or null
   */
  private async safeGetListing(
    layer: (typeof LAYER)[keyof typeof LAYER],
    chainId: number,
    listingId: string
  ) {
    try {
      const result = await this.subgraphService.getListingById(
        layer,
        chainId,
        listingId
      );
      // logger.info(`Successfully retrieved data for listing ${listingId}`);
      return result;
    } catch (error: any) {
      const errorMessage = error.toString();

      // Check if it's a rate limit error
      if (
        errorMessage.includes("429") ||
        errorMessage.includes("Too Many Requests")
      ) {
        logger.warn(
          `🚨 RATE LIMIT HIT for ${layer} (${chainId}): ${errorMessage}`
        );

        // Add more details for debugging
        const details = {
          layer,
          chainId,
          listingId,
          timestamp: new Date().toISOString(),
          fullError: error
        };

        logger.debug(`Rate limit details: ${JSON.stringify(details, null, 2)}`);

        // Throw a more descriptive error
        throw new CustomError(
          `Subgraph rate limit exceeded for ${layer} (${chainId}). Pause sync operations.`,
          400
        );
      }

      // Other errors
      logger.error(`Error fetching listing ${listingId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Modify the syncListingsForChain method to be more conservative and debuggable
   */
  private async syncListingsForChain(
    layer: (typeof LAYER)[keyof typeof LAYER],
    network: (typeof NETWORK)[keyof typeof NETWORK],
    chainId: number
  ) {
    logger.info(`===== Starting listing sync for ${layer} (${chainId}) =====`);

    try {
      // Get all listings from database for this chain that need checking
      const allListings = await listRepository.getActiveListingsByChain(
        this.db,
        layer,
        network,
        chainId
      );

      logger.info(
        `Found ${allListings.length} listings to check for ${layer} ${network} (${chainId})`
      );

      if (allListings.length === 0) {
        return;
      }

      // Process each listing with very small batches and significant delays
      const batchSize = 5; // Very small batch size
      let updatedCount = 0;
      let totalProcessed = 0;
      let rateLimitHits = 0;

      // Process settings
      const BATCH_DELAY = 15000; // 15 seconds between batches
      const MAX_RATE_LIMIT_HITS = 3; // Stop after this many rate limit errors

      for (let i = 0; i < allListings.length; i += batchSize) {
        // Check if we've hit too many rate limits and should stop
        if (rateLimitHits >= MAX_RATE_LIMIT_HITS) {
          logger.warn(
            `⚠️ Stopping sync for ${layer} (${chainId}) after ${rateLimitHits} rate limit hits`
          );
          break;
        }

        const batch = allListings.slice(i, i + batchSize);
        logger.info(
          `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allListings.length / batchSize)} for ${layer} (${chainId})`
        );

        // Track start time for performance monitoring
        const batchStartTime = Date.now();

        try {
          // Process the batch sequentially rather than in parallel
          for (const listing of batch) {
            try {
              const updated = await this.checkAndUpdateListingWithDebug(
                listing,
                layer,
                chainId
              );
              if (updated) updatedCount++;
              totalProcessed++;

              // Small delay between individual requests
              await this.delay(2000, "Spacing out individual requests");
            } catch (error: any) {
              if (error.message?.includes("RATE_LIMIT_ERROR")) {
                rateLimitHits++;
                // Longer pause after a rate limit
                await this.delay(60000, "Cooling down after rate limit hit");
              }
              // Continue with next listing even if one fails
              logger.error(
                `Error processing listing ${listing.id}, continuing with next: ${error}`
              );
            }
          }

          // Log batch completion with timing info
          const batchTime = Date.now() - batchStartTime;
          logger.info(
            `Completed batch in ${batchTime / 1000} seconds (${totalProcessed}/${allListings.length} listings processed)`
          );

          // Add a generous delay between batches
          if (i + batchSize < allListings.length) {
            await this.delay(
              BATCH_DELAY,
              `Standard delay between batches for ${layer} (${chainId})`
            );
          }
        } catch (error) {
          logger.error(`Error processing batch: ${error}`);
          // Add an even longer delay if a whole batch fails
          await this.delay(BATCH_DELAY * 2, "Extended delay after batch error");
        }

        // Log progress after each batch
        const progress = Math.min(
          100,
          Math.round((totalProcessed / allListings.length) * 100)
        );
        logger.info(
          `Sync progress for ${layer} (${chainId}): ${progress}% complete (${totalProcessed}/${allListings.length})`
        );
      }

      logger.info(
        `===== Completed sync for ${layer} (${chainId}): Updated ${updatedCount}/${totalProcessed} listings processed =====`
      );
    } catch (error) {
      logger.error(
        `CRITICAL ERROR during listing status sync for ${layer} (${chainId}): ${error}`
      );
    }
  }

  /**
   * Debug-friendly version of checkAndUpdateListing that logs each step
   */
  private async checkAndUpdateListingWithDebug(
    listing: any,
    layer: (typeof LAYER)[keyof typeof LAYER],
    chainId: number
  ): Promise<boolean> {
    const listingId = listing.id;

    try {
      const expectedListingId = listing.privateKey
        ? listing.privateKey
        : listing.onchainListingId;

      // Skip if no expectedListingId
      if (!expectedListingId) {
        logger.warn(
          `Listing ${listingId} has no expectedListingId (privateKey), skipping`
        );
        return false;
      }

      logger.debug(
        `Using on-chain ID ${expectedListingId} for listing ${listingId}`
      );

      // Check on-chain status with safe request
      const onChainListing = await this.safeGetListing(
        layer,
        chainId,
        expectedListingId
      );

      // If listing not found on-chain
      if (!onChainListing) {
        logger.debug(`On-chain listing not found for listing ${listingId}`);

        // For active listings that have been around for more than 24 hours but can't be found on-chain
        // we might want to mark them as cancelled
        if (listing.status === LIST_STATUS.ACTIVE) {
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const listedAt = new Date(listing.listedAt);

          if (listedAt < oneDayAgo) {
            logger.info(
              `Listing ${listingId} is active but not found on-chain for 24+ hours, marking as CANCELLED`
            );

            await this.db
              .updateTable("List")
              .set({
                status: LIST_STATUS.CANCELLED
              })
              .where("id", "=", listingId)
              .execute();

            logger.info(
              `Updated listing ${listingId} from ACTIVE to CANCELLED`
            );
            return true;
          }
        }

        return false;
      }

      logger.debug(
        `Found on-chain data for listing ${listingId}: status=${onChainListing.status}`
      );

      // Now we have both database and on-chain status, reconcile them
      const dbStatus = listing.status;
      const onChainStatus = onChainListing.status; // "ACTIVE", "SOLD", or "CANCELLED"

      logger.info(
        `Listing ${listingId} status comparison: DB=${dbStatus}, On-chain=${onChainStatus}`
      );

      // If statuses are consistent, no update needed
      if (
        (dbStatus === LIST_STATUS.ACTIVE && onChainStatus === "ACTIVE") ||
        (dbStatus === LIST_STATUS.SOLD && onChainStatus === "SOLD") ||
        (dbStatus === LIST_STATUS.CANCELLED && onChainStatus === "CANCELLED")
      ) {
        logger.debug(
          `Listing ${listingId} is already in sync, no update needed`
        );
        return false;
      }

      // Case 1: ACTIVE in DB but SOLD or CANCELLED on-chain
      if (dbStatus === LIST_STATUS.ACTIVE) {
        if (onChainStatus === "SOLD") {
          logger.info(`Updating listing ${listingId} from ACTIVE to SOLD`);

          await this.db
            .updateTable("List")
            .set({
              status: LIST_STATUS.SOLD,
              soldTxid: onChainListing.transactionHash,
              soldAt: onChainListing.soldTimestamp
                ? new Date(onChainListing.soldTimestamp * 1000)
                : new Date()
              // buyerId: onChainListing.buyer || null
            })
            .where("id", "=", listingId)
            .execute();

          logger.info(`Successfully updated listing ${listingId} to SOLD`);
          return true;
        } else if (onChainStatus === "CANCELLED") {
          logger.info(`Updating listing ${listingId} from ACTIVE to CANCELLED`);

          await this.db
            .updateTable("List")
            .set({
              status: LIST_STATUS.CANCELLED
            })
            .where("id", "=", listingId)
            .execute();

          logger.info(`Successfully updated listing ${listingId} to CANCELLED`);
          return true;
        }
      }

      // Case 2: PENDING in DB but ACTIVE, SOLD, or CANCELLED on-chain
      if (dbStatus === LIST_STATUS.PENDING) {
        if (onChainStatus === "ACTIVE") {
          const existingActiveList = await this.db
            .selectFrom("List")
            // .where("List.collectibleId", "=", listing.collectibleId)
            .where((eb) =>
              eb.or([
                eb("List.privateKey", "=", expectedListingId),
                eb("List.onchainListingId", "=", expectedListingId)
              ])
            )
            .where("List.status", "=", LIST_STATUS.ACTIVE)
            .executeTakeFirst();

          if (existingActiveList) {
            logger.info(
              `Skipping listing ${listingId} from PENDING to ACTIVE. Already active`
            );

            return false;
          }

          logger.info(`Updating listing ${listingId} from PENDING to ACTIVE`);

          await this.db
            .updateTable("List")
            .set({
              status: LIST_STATUS.ACTIVE,
              vaultTxid: onChainListing.transactionHash || listing.vaultTxid
            })
            .where("id", "=", listingId)
            .execute();

          logger.info(`Successfully updated listing ${listingId} to ACTIVE`);
          return true;
        } else if (onChainStatus === "SOLD") {
          const existingSoldList = await this.db
            .selectFrom("List")
            .where((eb) =>
              eb.or([
                eb("List.privateKey", "=", expectedListingId),
                eb("List.onchainListingId", "=", expectedListingId)
              ])
            )
            .where("List.status", "=", LIST_STATUS.SOLD)
            .executeTakeFirst();

          if (existingSoldList) {
            logger.info(
              `Skipping listing ${listingId} from PENDING to SOLD. Already sold`
            );

            return false;
          }

          logger.info(`Updating listing ${listingId} from PENDING to SOLD`);

          await this.db
            .updateTable("List")
            .set({
              status: LIST_STATUS.SOLD,
              vaultTxid: onChainListing.transactionHash || listing.vaultTxid,
              soldTxid: onChainListing.transactionHash,
              soldAt: onChainListing.soldTimestamp
                ? new Date(onChainListing.soldTimestamp * 1000)
                : new Date()
              // buyerId: onChainListing.buyer || null
            })
            .where("id", "=", listingId)
            .execute();

          logger.info(`Successfully updated listing ${listingId} to SOLD`);
          return true;
        } else if (onChainStatus === "CANCELLED") {
          const existingCancelledList = await this.db
            .selectFrom("List")
            .where((eb) =>
              eb.or([
                eb("List.privateKey", "=", expectedListingId),
                eb("List.onchainListingId", "=", expectedListingId)
              ])
            )
            .where("List.status", "=", LIST_STATUS.CANCELLED)
            .executeTakeFirst();

          if (existingCancelledList) {
            logger.info(
              `Skipping listing ${listingId} from PENDING to CANCELLED. Already cancelled`
            );

            return false;
          }

          logger.info(
            `Updating listing ${listingId} from PENDING to CANCELLED`
          );

          await this.db
            .updateTable("List")
            .set({
              status: LIST_STATUS.CANCELLED,
              vaultTxid: onChainListing.transactionHash || listing.vaultTxid
            })
            .where("id", "=", listingId)
            .execute();

          logger.info(`Successfully updated listing ${listingId} to CANCELLED`);
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error(`Error checking listing ${listingId}: ${error}`);
      return false;
    }
  }
}
