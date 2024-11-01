import { redis } from "..";
import { config } from "../config/config";
import logger from "../config/winston";
import { CustomError } from "../exceptions/CustomError";
import { REDIS_KEYS } from "./constants";

export type Collection = {
  startTime: Date;
  lastUpdateTime: Date;
  remainingCalls: number;
};

export type LimiterConfig = {
  maxConcurrentCollections: number;
  timeoutMinutes: number;
  retryConfig: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffFactor: number;
  };
};

export type LimiterStore = {
  config: LimiterConfig;
  activeCollections: Map<string, Collection>;
};

export type UploadResult = {
  success: boolean;
  uploadedFiles: string[];
  failedFiles: Array<{ fileName: string; error: string }>;
  retryCount: number;
};

export type FileUpload = {
  name: string;
  content: Buffer;
};

export const cleanupStaleCollections = async (): Promise<void> => {
  try {
    const now = new Date();
    const keys = await redis.keys(`${REDIS_KEYS.COLLECTION_PREFIX}*`);

    for (const key of keys) {
      const collectionData = await redis.get(key);
      if (collectionData) {
        const collection: Collection = JSON.parse(collectionData);
        const timeDiff =
          (now.getTime() - new Date(collection.lastUpdateTime).getTime()) /
          (1000 * 60);

        if (timeDiff > config.COLLECTION_TIMEOUT_MINUTES) {
          const collectionId = key.replace(REDIS_KEYS.COLLECTION_PREFIX, "");
          logger.warn(
            `Collection ${collectionId} timed out after ${timeDiff.toFixed(
              2
            )} minutes of inactivity`
          );
          await redis.del(key);
        }
      }
    }
  } catch (error) {
    logger.error("Error cleaning up stale collections:", error);
    throw new Error("Failed to cleanup stale collections");
  }
};

export const acquireSlot = async (
  collectionId: string,
  totalBatches: number
): Promise<boolean> => {
  try {
    await cleanupStaleCollections();

    const collectionKey = REDIS_KEYS.getCollectionKey(collectionId);
    const existingCollection = await redis.get(collectionKey);

    if (existingCollection) {
      const collection: Collection = JSON.parse(existingCollection);
      collection.lastUpdateTime = new Date();
      await redis.set(collectionKey, JSON.stringify(collection));
      logger.info(`Updated existing collection ${collectionId}`);
      return true;
    }

    const activeCollections = await redis.keys(
      `${REDIS_KEYS.COLLECTION_PREFIX}*`
    );
    if (activeCollections.length >= config.MAX_CONCURRENT_COLLECTIONS) {
      logger.warn(
        `Slot acquisition failed for collection ${collectionId}: concurrent limit reached`
      );
      throw new CustomError(
        "Slot acquisition failed for collection ${collectionId}: concurrent limit reached",
        400
      );
    }

    const now = new Date();
    const collection: Collection = {
      startTime: now,
      lastUpdateTime: now,
      remainingCalls: totalBatches,
    };

    await redis.set(collectionKey, JSON.stringify(collection));
    logger.info(`Acquired slot for new collection ${collectionId}`);
    return true;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    logger.error(`Error acquiring slot for collection ${collectionId}:`, error);
    throw new Error("Failed to acquire processing slot");
  }
};

export const updateProgress = async (
  collectionId: string
): Promise<boolean> => {
  try {
    await cleanupStaleCollections();

    const collectionKey = REDIS_KEYS.getCollectionKey(collectionId);
    const collectionData = await redis.get(collectionKey);

    if (!collectionData) {
      throw new CustomError(
        `Collection ${collectionId} not found in active uploads`,
        404
      );
    }

    const collection: Collection = JSON.parse(collectionData);
    collection.lastUpdateTime = new Date();
    collection.remainingCalls--;

    if (collection.remainingCalls <= 0) {
      await redis.del(collectionKey);
      logger.info(`Collection ${collectionId} completed`);
      return true;
    }

    await redis.set(collectionKey, JSON.stringify(collection));
    logger.info(
      `Updated progress for collection ${collectionId}, remaining calls: ${collection.remainingCalls}`
    );
    return false;
  } catch (error) {
    logger.error(
      `Error updating progress for collection ${collectionId}:`,
      error
    );
    if (error instanceof CustomError) throw error;
    throw new Error("Failed to update collection progress");
  }
};

export const forceReleaseSlot = async (collectionId: string): Promise<void> => {
  try {
    const collectionKey = REDIS_KEYS.getCollectionKey(collectionId);
    await redis.del(collectionKey);
    logger.info(`Forcefully released slot for collection ${collectionId}`);
  } catch (error) {
    logger.error(`Error releasing slot for collection ${collectionId}:`, error);
    throw new Error("Failed to release collection slot");
  }
};

export const getSystemCapacity = async () => {
  try {
    const activeCollections = await redis.keys(
      `${REDIS_KEYS.COLLECTION_PREFIX}*`
    );
    const currentLoad = activeCollections.length;

    return {
      available: currentLoad < config.MAX_CONCURRENT_COLLECTIONS,
      currentLoad,
      maxCapacity: config.MAX_CONCURRENT_COLLECTIONS,
    };
  } catch (error) {
    logger.error("Error getting system capacity:", error);
    throw new Error("Unable to determine system capacity");
  }
};
