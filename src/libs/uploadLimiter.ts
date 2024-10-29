import { redis } from "..";
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

/**
 * Initialize limiter configuration
 */
export const initializeLimiter = async (
  initialConfig: Partial<LimiterConfig> = {}
): Promise<void> => {
  const config: LimiterConfig = {
    maxConcurrentCollections: initialConfig.maxConcurrentCollections ?? 3,
    timeoutMinutes: initialConfig.timeoutMinutes ?? 10,
    retryConfig: {
      maxRetries: initialConfig.retryConfig?.maxRetries ?? 3,
      initialDelayMs: initialConfig.retryConfig?.initialDelayMs ?? 1000,
      maxDelayMs: initialConfig.retryConfig?.maxDelayMs ?? 10000,
      backoffFactor: initialConfig.retryConfig?.backoffFactor ?? 2,
    },
  };

  const existingConfig = await redis.get(REDIS_KEYS.CONFIG);
  if (!existingConfig) {
    await redis.set(REDIS_KEYS.CONFIG, JSON.stringify(config));
    logger.info("Initialized limiter configuration", { config });
  }
};

/**
 * Remove stale collections based on timeout configuration
 */
export const cleanupStaleCollections = async (): Promise<void> => {
  try {
    const config = await getCurrentConfig();
    const now = new Date();

    const keys = await redis.keys(`${REDIS_KEYS.COLLECTION_PREFIX}*`);

    for (const key of keys) {
      const collectionData = await redis.get(key);
      if (collectionData) {
        const collection: Collection = JSON.parse(collectionData);
        const timeDiff =
          (now.getTime() - new Date(collection.lastUpdateTime).getTime()) /
          (1000 * 60);

        if (timeDiff > config.timeoutMinutes) {
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

/**
 * Attempt to acquire a slot for collection processing
 */
export const acquireSlot = async (
  collectionId: string,
  totalBatches: number
): Promise<boolean> => {
  try {
    await cleanupStaleCollections();
    const config = await getCurrentConfig();

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
    if (activeCollections.length >= config.maxConcurrentCollections) {
      logger.warn(
        `Slot acquisition failed for collection ${collectionId}: concurrent limit reached`
      );
      return false;
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
    logger.error(`Error acquiring slot for collection ${collectionId}:`, error);
    throw new Error("Failed to acquire processing slot");
  }
};

/**
 * Update collection progress and check if complete
 */
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
        400
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

/**
 * Force release a collection slot
 */
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

/**
 * Update limiter configuration
 */
export const updateConfig = async (
  newConfig: Partial<LimiterConfig>
): Promise<LimiterConfig> => {
  try {
    const currentConfig = await getCurrentConfig();
    const updatedConfig: LimiterConfig = {
      ...currentConfig,
      ...newConfig,
      retryConfig: {
        ...currentConfig.retryConfig,
        ...newConfig.retryConfig,
      },
    };

    await redis.set(REDIS_KEYS.CONFIG, JSON.stringify(updatedConfig));
    logger.info("Updated limiter configuration", { config: updatedConfig });
    return updatedConfig;
  } catch (error) {
    logger.error("Error updating configuration:", error);
    throw new Error("Failed to update configuration");
  }
};

/**
 * Get current limiter configuration
 */
export const getCurrentConfig = async (): Promise<LimiterConfig> => {
  try {
    const config = await redis.get(REDIS_KEYS.CONFIG);
    if (!config) {
      throw new Error("Configuration not found");
    }
    return JSON.parse(config);
  } catch (error) {
    logger.error("Error getting configuration:", error);
    if (error instanceof CustomError) throw error;
    throw new Error("Failed to get configuration");
  }
};

/**
 * Get status of all active collections
 */
export const getStatus = async () => {
  try {
    await cleanupStaleCollections();
    const now = new Date();

    const keys = await redis.keys(`${REDIS_KEYS.COLLECTION_PREFIX}*`);
    const collections = await Promise.all(
      keys.map(async (key) => {
        const collectionData = await redis.get(key);
        if (!collectionData) return null;

        const collection: Collection = JSON.parse(collectionData);
        const collectionId = key.replace(REDIS_KEYS.COLLECTION_PREFIX, "");

        return {
          collectionId,
          startTime: new Date(collection.startTime),
          lastUpdateTime: new Date(collection.lastUpdateTime),
          remainingCalls: collection.remainingCalls,
          idleMinutes:
            (now.getTime() - new Date(collection.lastUpdateTime).getTime()) /
            (1000 * 60),
        };
      })
    );

    return collections.filter((c): c is NonNullable<typeof c> => c !== null);
  } catch (error) {
    logger.error("Error getting status:", error);
    throw new Error("Failed to get limiter status");
  }
};

/**
 * Get complete limiter status including configuration and active collections
 */
export const getLimiterStatus = async () => {
  try {
    const [config, status] = await Promise.all([
      getCurrentConfig(),
      getStatus(),
    ]);

    return {
      config,
      activeCollections: status,
      availableSlots: Math.max(
        0,
        config.maxConcurrentCollections - status.length
      ),
    };
  } catch (error) {
    logger.error("Error getting limiter status:", error);
    throw new Error("Failed to get limiter status");
  }
};
