import { redis } from "..";
import { EVM_CONFIG } from "../../blockchain/evm/evm-config";
import { EVMCollectibleService } from "../../blockchain/evm/services/evmIndexService";
import logger from "../config/winston";
import { collectionRepository } from "../repositories/collectionRepository";
import { db } from "../utils/db";
const cron = require("node-cron");

export class CollectionOwnerCounterService {
  private readonly LOCK_TTL: number;
  private readonly MIN_BATCH_SIZE: number;
  private readonly MAX_BATCH_SIZE: number;
  private readonly INSTANCE_HEARTBEAT_TTL: number;
  private readonly instanceId: string;
  private heartbeatInterval?: NodeJS.Timeout;
  private readonly TWO_HOURS_MS = 2 * 60 * 60 * 1000; // 2 hours in millisecond
  private readonly evmService: EVMCollectibleService;

  constructor() {
    this.LOCK_TTL = 5 * 60; // 5 minutes
    this.MIN_BATCH_SIZE = 1;
    this.MAX_BATCH_SIZE = 5;
    this.INSTANCE_HEARTBEAT_TTL = 60; // 1 minute
    this.instanceId = `instance:${process.pid}:${Math.random()
      .toString(36)
      .slice(2)}`;

    this.evmService = new EVMCollectibleService(EVM_CONFIG.RPC_URL);
  }

  async startHeartbeat(): Promise<void> {
    const heartbeat = async () => {
      await redis.setex(
        `heartbeat:nft_counter:${this.instanceId}`,
        this.INSTANCE_HEARTBEAT_TTL,
        Date.now()
      );
    };

    await heartbeat();
    this.heartbeatInterval = setInterval(
      heartbeat,
      (this.INSTANCE_HEARTBEAT_TTL * 1000) / 2
    );
  }

  async stopHeartbeat(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      await redis.del(`heartbeat:nft_counter:${this.instanceId}`);
    }
  }

  async getActiveInstanceCount(): Promise<number> {
    const heartbeatKeys = await redis.keys("heartbeat:nft_counter:*");
    return heartbeatKeys.length;
  }

  async calculateOptimalBatchSize(): Promise<number> {
    const totalCollections =
      await collectionRepository.countSyntheticCollections();
    if (!totalCollections) throw new Error("Could not count the collections.");

    const activeInstances = await this.getActiveInstanceCount();
    const collectionsPerInstance = Math.ceil(
      totalCollections / activeInstances
    );
    let calculatedBatchSize = Math.ceil(collectionsPerInstance / 10);

    logger.info({
      totalCollections,
      activeInstances,
      collectionsPerInstance,
      calculatedBatchSize,
      finalBatchSize: Math.max(
        this.MIN_BATCH_SIZE,
        Math.min(this.MAX_BATCH_SIZE, calculatedBatchSize)
      ),
    });

    return Math.max(
      this.MIN_BATCH_SIZE,
      Math.min(this.MAX_BATCH_SIZE, calculatedBatchSize)
    );
  }
  async acquireLock(lockKey: string): Promise<boolean> {
    const acquired = await redis.set(
      lockKey,
      this.instanceId,
      "EX",
      this.LOCK_TTL,
      "NX"
    );
    return acquired === "OK";
  }

  async releaseLock(lockKey: string): Promise<void> {
    const lockOwner = await redis.get(lockKey);
    if (lockOwner === this.instanceId) {
      await redis.del(lockKey);
    }
  }

  private async getLastProcessedTime(collectionId: string): Promise<number> {
    const lastProcessed = await redis.get(`last_processed:${collectionId}`);
    return lastProcessed ? parseInt(lastProcessed) : 0;
  }

  private async setLastProcessedTime(collectionId: string): Promise<void> {
    await redis.set(`last_processed:${collectionId}`, Date.now().toString());
  }

  private async shouldProcessCollection(
    collectionId: string
  ): Promise<boolean> {
    const lastProcessed = await this.getLastProcessedTime(collectionId);
    return Date.now() - lastProcessed >= this.TWO_HOURS_MS;
  }

  async processCollectionBatch(
    collections: Array<{ id: string; contractAddress?: string | null }>
  ): Promise<void> {
    for (const collection of collections) {
      try {
        if (!collection.contractAddress) {
          logger.warn(`Collection ${collection.id} has no contract address`);
          continue;
        }

        if (!(await this.shouldProcessCollection(collection.id))) {
          logger.info(
            `Skipping collection ${collection.id} - Not due for processing yet`
          );
          continue;
        }

        const uniqueOwnersCount =
          await this.evmService.getCollectionOwnersCount(
            collection.contractAddress
          );

        await collectionRepository.update(db, collection.id, {
          ownerCount: uniqueOwnersCount,
        });

        await this.setLastProcessedTime(collection.id);

        logger.info(
          `Updated owner count for collection ${collection.id}: ${uniqueOwnersCount} owners`
        );
      } catch (error) {
        logger.error(
          `Failed to update owner count for collection ${collection.id}:`,
          error
        );
      }
    }
  }

  async getUniqueOwnersCount(collection: {
    id: string;
    address?: string;
  }): Promise<number> {
    // Implement your blockchain-specific logic here
    logger.info(`Getting unique owners count for collection ${collection.id}`);
    return 0; // Replace with actual implementation
  }

  async updateOwnerCounts(): Promise<void> {
    try {
      const batchSize = await this.calculateOptimalBatchSize();
      const totalCollections =
        await collectionRepository.countSyntheticCollections();
      if (!totalCollections)
        throw new Error("Could not count the collections.");

      let offset = 0;
      let processedCount = 0;

      logger.info(
        `Starting update process for ${totalCollections} collections with batch size ${batchSize}`
      );

      while (true) {
        const batchLockKey = `owner_count_update:${offset}:${
          new Date().toISOString().split("T")[0]
        }`;

        if (!(await this.acquireLock(batchLockKey))) {
          offset += batchSize;
          continue;
        }

        logger.info(
          `${this.instanceId} has started processing the batch: ${batchLockKey}`
        );

        try {
          const collections =
            await collectionRepository.getSyntheticCollectionsWithOffsetAndPagination(
              offset,
              batchSize
            );

          console.log("The collections to be processed: ", collections);

          if (collections.length === 0) break;

          await this.processCollectionBatch(collections);
          processedCount += collections.length;
          offset += batchSize;

          logger.info(
            `Progress: ${processedCount}/${totalCollections} collections processed (${Math.round(
              (processedCount / totalCollections) * 100
            )}%)`
          );
        } finally {
          await this.releaseLock(batchLockKey);
        }
        // await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      logger.error("Error in owner count update job:", error);
      await this.stopHeartbeat();
    }
  }

  async startScheduler(): Promise<void> {
    await this.startHeartbeat();

    // logger.info(`active instance count: ${this.getActiveInstanceCount().}`);
    console.log(await this.getActiveInstanceCount());

    // Run every 2 hours
    cron.schedule("0 */2 * * *", async () => {
      await this.updateOwnerCounts();
    });

    // // Run every minute
    // cron.schedule("* * * * *", async () => {
    //   await this.updateOwnerCounts();
    // });
  }
}
