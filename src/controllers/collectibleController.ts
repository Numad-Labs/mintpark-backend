import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../../custom";
import { CustomError } from "../exceptions/CustomError";
import { collectibleServices } from "../services/collectibleServices";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { collectibleTraitRepository } from "../repositories/collectibleTraitRepository";
import logger from "../config/winston";
import { z } from "zod";
import { collectionRepository } from "@repositories/collectionRepository";
import { db } from "@utils/db";
import subgraphService from "@blockchain/evm/services/subgraph/subgraphService";
import { COLLECTIBLE_STATUS, LAYER } from "@app-types/db/enums";
import { sql } from "kysely";
import axios from "axios";
import { config } from "@config/config";
import { getObjectFromS3, uploadToS3 } from "@utils/aws";
import sharp from "sharp";
import SubgraphService from "@blockchain/evm/services/subgraph/subgraphService";
import { layerRepository } from "@repositories/layerRepository";

const DEFAULT_LIMIT = 30,
  MAX_LIMIT = 50;

export interface traitFilter {
  name: string;
  value: string;
}

export interface ipfsData {
  CIDs?: string[];
  file?: Express.Multer.File;
}

type OrderByOption = "price" | "recent";
type OrderDirectionOption = "asc" | "desc";

export interface CollectibleQueryParams {
  orderBy?: OrderByOption;
  orderDirection?: OrderDirectionOption;
  isListed: boolean;
  collectionIds?: string[];
  traitValuesByType?: Record<string, string[]>;
  traits?: string[];
  layerId: string;
  userLayerId?: string;
  limit: number;
  offset: number;
  query?: string;
}

// export interface recursiveInscriptionParams {
//   traits: { traitTypeId: string; traitValueId: string }[];
// }

const attributeSchema = z.object({
  trait_type: z.string(),
  value: z.string()
});

const fileSchema = z.object({
  uri: z.string(),
  type: z.string()
});

const propertiesSchema = z.object({
  files: z.array(fileSchema),
  category: z.string(),
  creators: z.array(z.unknown()) // Adjust type if creators have a known structure
});

const payloadSchema = z.object({
  name: z.string(),
  description: z.string(),
  external_url: z.string().optional(), // Allow empty string
  image: z.string(),
  attributes: z.array(attributeSchema),
  properties: propertiesSchema,
  compiler: z.string()
});

const payloadArraySchema = z.array(payloadSchema);
export type TraitPayload = z.infer<typeof payloadSchema>;

export const collectibleControllers = {
  getListableCollectibles: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { orderBy, orderDirection, layerId, userLayerId, query } =
        req.query as unknown as CollectibleQueryParams;

      const isListed = req.query.isListed === "true";
      const collectionIds: string[] = req.query.collectionIds
        ? JSON.parse(req.query.collectionIds as string)
        : [];
      const { userId } = req.params;
      const limit = Math.min(
        Number(req.query.limit) || DEFAULT_LIMIT,
        MAX_LIMIT
      );
      const offset = Number(req.query.offset) || 0;

      if (req.user?.id !== userId)
        throw new CustomError("You are not allowed to fetch this data.", 400);

      const result = await collectibleServices.getListableCollectibles(userId, {
        isListed,
        orderBy,
        orderDirection,
        collectionIds,
        layerId,
        userLayerId,
        limit,
        offset,
        query
      });
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (e) {
      next(e);
    }
  },
  getListableCollectiblesByCollectionId: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectionId } = req.params;
      const { orderBy, orderDirection, layerId, query } =
        req.query as unknown as CollectibleQueryParams;
      const isListed = req.query.isListed === "true";
      const traitValuesByType: Record<string, string[]> = req.query
        .traitValuesByType
        ? JSON.parse(req.query.traitValuesByType as string)
        : undefined;

      const limit = Math.min(
        Number(req.query.limit) || DEFAULT_LIMIT,
        MAX_LIMIT
      );
      const offset = Number(req.query.offset) || 0;

      const result =
        await collectibleServices.getListableCollectiblesByCollectionId(
          collectionId,
          {
            orderBy,
            orderDirection,
            isListed,
            traitValuesByType,
            layerId,
            limit,
            offset,
            query
          },
          req.user?.id
        );

      return res.status(200).json({
        success: true,
        data: {
          collectibles: result.listableCollectibles,
          listedCollectibleCount: result.activeListCount,
          hasMore: result.hasMore
        }
      });
    } catch (e) {
      next(e);
    }
  },
  getCollectibleById: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const collectible = await collectibleRepository.getByIdWithDetails(
        id,
        req.user?.id
      );
      return res.status(200).json({ success: true, data: collectible });
    } catch (e) {
      next(e);
    }
  },

  getCollectionActivity: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectionId } = req.params;
      const {
        chainId = 43111,
        limit = 20,
        offset = 0,
        sortBy = "blockTimestamp",
        sortDirection = "desc",
        activityType
      } = req.query;

      if (!collectionId) {
        throw new CustomError("Collection ID is required", 400);
      }

      const layer = LAYER.HEMI;

      // Validate chain ID
      const numericChainId = parseInt(chainId as string);
      if (isNaN(numericChainId)) {
        throw new CustomError("Invalid chainId. Must be a number", 400);
      }

      // Validate sortDirection
      if (sortDirection && !["asc", "desc"].includes(sortDirection as string)) {
        throw new CustomError(
          'Invalid sortDirection. Must be "asc" or "desc"',
          400
        );
      }

      const allowedActivityTypes = ["CREATED", "SOLD", "CANCELLED"];
      let activityTypes: string[] = allowedActivityTypes;

      if (activityType) {
        const requestedTypes = (activityType as string)
          .split(",")
          .map((t) => t.trim().toUpperCase());
        const invalidTypes = requestedTypes.filter(
          (t) => !allowedActivityTypes.includes(t)
        );
        if (invalidTypes.length > 0) {
          return res.status(400).json({
            success: false,
            message: `Invalid activityType(s): ${invalidTypes.join(", ")}`
          });
        }
        activityTypes = requestedTypes;
      }

      // Get collection address from repository by collection ID
      const collection = await collectionRepository.getById(db, collectionId);

      if (!collection) {
        throw new CustomError("Collection not found", 404);
      }

      const collectionAddress = collection.contractAddress;

      if (!collectionAddress)
        throw new CustomError("Collection address not found", 400);

      const subgraphService = new SubgraphService();
      const result = await subgraphService.getCollectionActivity(
        layer,
        numericChainId,
        collectionAddress,
        {
          limit: parseInt(limit as string) || 20,
          offset: parseInt(offset as string) || 0,
          sortBy: sortBy as string,
          sortDirection: ((sortDirection as string) || "desc") as
            | "asc"
            | "desc",
          activityTypes
        }
      );
      // Enhance the activities with collectible names - optimized approach
      if (result.activities && result.activities.length > 0) {
        // Extract all unique token IDs for a single batch query
        const uniqueIdxSet = new Set<string>();
        result.activities.forEach((activity) => {
          const { tokenId, contractAddress } = activity.item;
          const uniqueIdx = `${contractAddress.toLowerCase()}i${tokenId}`;
          uniqueIdxSet.add(uniqueIdx);
        });

        const uniqueIdxList = Array.from(uniqueIdxSet);

        // Get all collectibles in a single query
        const collectibles =
          await collectibleRepository.getCollectiblesByUniqueIdxinBatch(
            uniqueIdxList
          );

        // Create a lookup map for fast access - using lowercase keys for matching
        const collectibleMap = new Map();
        collectibles.forEach((collectible) => {
          // Convert to lowercase for matching
          if (collectible.uniqueIdx) {
            const lowerCaseKey = collectible.uniqueIdx.toLowerCase();
            collectibleMap.set(lowerCaseKey, {
              name: collectible.name,
              fileKey: collectible.fileKey,
              collectibleId: collectible.id
            });
          }
        });

        // Enhance activities with names from the map
        const enhancedActivities = result.activities.map((activity) => {
          const { tokenId, contractAddress } = activity.item;
          const uniqueIdx = `${contractAddress.toLowerCase()}i${tokenId}`;
          const collectibleData = collectibleMap.get(uniqueIdx);

          return {
            ...activity,
            item: {
              ...activity.item,
              name: collectibleData?.name || null,
              fileKey: collectibleData?.fileKey || null,
              collectibleId: collectibleData.collectibleId || null
            }
          };
        });

        // Replace the original activities with enhanced ones
        result.activities = enhancedActivities;
      }

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  },
  getTokenActivity: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { collectibleId } = req.params;
      const {
        chainId = 43111,
        limit = 20,
        offset = 0,
        sortBy = "blockTimestamp",
        sortDirection = "desc"
      } = req.query;
      if (!collectibleId) {
        throw new CustomError("collectibleId is required", 400);
      }

      const layer = LAYER.HEMI;

      // Validate chain ID
      const numericChainId = parseInt(chainId as string);
      if (isNaN(numericChainId)) {
        throw new CustomError("Invalid chainId. Must be a number", 400);
      }

      // Validate sortDirection
      if (sortDirection && !["asc", "desc"].includes(sortDirection as string)) {
        throw new CustomError(
          'Invalid sortDirection. Must be "asc" or "desc"',
          400
        );
      }

      const collectible = await collectibleRepository.getById(
        db,
        collectibleId
      );

      if (!collectible) throw new CustomError("Collectible not found", 404);
      if (!collectible.uniqueIdx)
        throw new CustomError("Unique IDx not found", 400);
      const contractAddress = collectible.uniqueIdx.split("i")[0];
      const tokenId = collectible.uniqueIdx.split("i")[1];
      const subgraphService = new SubgraphService();

      const result = await subgraphService.getTokenActivity(
        layer,
        numericChainId,
        contractAddress,
        tokenId,
        {
          limit: parseInt(limit as string) || 20,
          offset: parseInt(offset as string) || 0,
          sortBy: sortBy as string,
          sortDirection: ((sortDirection as string) || "desc") as "asc" | "desc"
        }
      );

      // const activities = await collectibleServices.getActivityByCollectibleId(
      //   collectibleId
      // );

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  },
  // update: async (
  //   req: AuthenticatedRequest,
  //   res: Response,
  //   next: NextFunction
  // ) => {},
  // createInscriptionInBatch: async (
  //   req: AuthenticatedRequest,
  //   res: Response,
  //   next: NextFunction
  // ) => {
  //   try {
  //     if (!req.user?.id)
  //       throw new CustomError("Could not parse the id from the token.", 400);

  //     const { collectionId } = req.body;
  //     const files: Express.Multer.File[] = req.files as Express.Multer.File[];

  //     if (files.length === 0)
  //       throw new CustomError("Please provide the files.", 400);
  //     if (files.length > 10)
  //       throw new CustomError("You cannot provide more than 10 files.", 400);

  //     const result =
  //       await collectibleServices.createInscriptionAndOrderItemInBatch(
  //         req.user.id,
  //         collectionId,
  //         files
  //       );

  //     return res.status(200).json({ success: true, data: result });
  //   } catch (e) {
  //     next(e);
  //   }
  // },
  // createRecursiveInscriptionInBatch: async (
  //   req: AuthenticatedRequest,
  //   res: Response,
  //   next: NextFunction
  // ) => {
  //   try {
  //     if (!req.user?.id)
  //       throw new CustomError("Could not parse the id from the token.", 400);

  //     const { collectionId } = req.body;
  //     const data: recursiveInscriptionParams[] = Array.isArray(req.body.data)
  //       ? req.body.data
  //       : req.body.data
  //       ? [req.body.data]
  //       : [];
  //     if (data.length === 0)
  //       throw new CustomError("Please provide the data.", 400);
  //     if (data.length > 10)
  //       throw new CustomError(
  //         "You cannot provide more than 10 elements of data.",
  //         400
  //       );

  //     const result =
  //       await collectibleServices.createRecursiveInscriptionAndOrderItemInBatch(
  //         req.user.id,
  //         collectionId,
  //         data
  //       );

  //     return res.status(200).json({ success: true, data: result });
  //   } catch (e) {
  //     next(e);
  //   }
  // },
  // createIpfsNftInBatch: async (
  //   req: AuthenticatedRequest,
  //   res: Response,
  //   next: NextFunction
  // ) => {
  //   try {
  //     if (!req.user?.id)
  //       throw new CustomError("Could not parse the id from the token.", 400);

  //     const { collectionId } = req.body;
  //     const data: ipfsData = Array.isArray(req.body.data)
  //       ? req.body.data
  //       : req.body.data
  //       ? [req.body.data]
  //       : [];
  //     // if (data.length === 0)
  //     //   throw new CustomError("Please provide the data.", 400);
  //     // if (data.length > 10)
  //     //   throw new CustomError(
  //     //     "You cannot provide more than 10 elements of data.",
  //     //     400
  //     //   );

  //     const result = await collectibleServices.createIpfsNftAndOrderItemInBatch(
  //       req.user.id,
  //       collectionId,
  //       data
  //     );

  //     return res.status(200).json({ success: true, data: result });
  //   } catch (e) {
  //     next(e);
  //   }
  // },
  getCollectiblesForIpfsUpload: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Could not parse the id from the token.", 400);

      const { offset, limit } = req.query;
      const { collectionId } = req.query;

      logger.info({ offset, limit, collectionId });

      if (!collectionId || !offset || !limit)
        throw new CustomError("Invalid input.", 400);

      const collectibles =
        await collectibleRepository.getCollectiblesWithNoCidByCollectionId(
          collectionId.toString(),
          parseInt(offset.toString()),
          parseInt(limit.toString())
        );

      return res.status(200).json({ success: true, data: collectibles });
    } catch (e) {
      next(e);
    }
  },
  uploadFileToIpfs: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Could not parse the id from the token.", 400);

      const { collectibleId } = req.body;

      await collectibleServices.uploadFileToIpfs(collectibleId);

      return res.status(200).json({ success: true });
    } catch (e) {
      next(e);
    }
  },
  updateIpfs: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { collectibleId, ipfsUri, fileKey } = req.body;

      if (!collectibleId || !ipfsUri) {
        throw new CustomError("collectibleId and ipfsUri are required", 400);
      }

      // First check if the collectible exists and get its current state
      const existingCollectible = await collectibleRepository.getById(
        db,
        collectibleId
      );
      if (!existingCollectible) {
        throw new CustomError("Collectible not found", 404);
      }

      // Check if we need to update the fileKey (for non-OOO editions)
      const shouldUpdateFileKey = fileKey && !existingCollectible.fileKey;

      // If the collectible already has CID and we don't need to update the fileKey,
      // return success without updating. This makes the endpoint idempotent.
      if (existingCollectible.cid && !shouldUpdateFileKey) {
        logger.info(
          `Collectible ${collectibleId} already has CID and no fileKey update needed`
        );
        return res.status(200).json({
          success: true,
          data: {
            id: existingCollectible.id,
            cid: existingCollectible.cid,
            fileKey: existingCollectible.fileKey,
            alreadyHadCid: true
          }
        });
      }

      const result = await db.transaction().execute(async (trx) => {
        if (existingCollectible.parentCollectibleId && fileKey) {
          const parentCollectible = await collectibleRepository.getById(
            trx,
            existingCollectible.parentCollectibleId
          );
          if (parentCollectible && !parentCollectible.fileKey)
            await collectibleRepository.update(trx, parentCollectible.id, {
              fileKey
            });
        }

        // Update the collectible with the new CID and optionally fileKey
        const updateData = {
          cid: ipfsUri.replace("ipfs://", "")
        };

        let updatedCollectible: any;
        // Only update fileKey if it's provided and the collectible doesn't have one
        if (shouldUpdateFileKey) {
          logger.info(
            `Updating collectible ${collectibleId} with new fileKey: ${fileKey}`
          );
          // Update with fileKey
          updatedCollectible = await collectibleRepository.update(
            trx,
            collectibleId,
            {
              ...updateData,
              fileKey
            }
          );
        } else {
          // Update without fileKey
          updatedCollectible = await collectibleRepository.update(
            trx,
            collectibleId,
            updateData
          );
        }

        return updatedCollectible;
      });

      return res.status(200).json({
        success: true,
        data: {
          id: result.id,
          cid: result.cid,
          alreadyHadCid: false
        }
      });
    } catch (e) {
      next(e);
    }
  },
  insertTraits: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Could not parse the id from the token.", 400);

      const { collectionId } = req.body;
      const data = payloadArraySchema.parse(req.body.items);

      await collectibleServices.insertTraits(collectionId, data, req.user.id);

      return res.status(200).json({ success: true });
    } catch (e) {
      next(e);
    }
  },

  /**
   * Get a collectible by ID for interservice communication
   * This endpoint returns a collectible regardless of its status (including UNCONFIRMED)
   * It requires API key authentication instead of user authentication
   */
  getCollectibleByIdForService: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // The apiKeyAuth middleware already validated the API key
      const { collectibleId } = req.params;

      if (!collectibleId) {
        throw new CustomError("Collectible ID is required", 400);
      }

      // Get the collectible regardless of status
      const collectible =
        await collectibleRepository.getCollectibleByIdForService(collectibleId);

      if (!collectible) {
        throw new CustomError("Collectible not found", 404);
      }

      return res.status(200).json({
        success: true,
        data: collectible
      });
    } catch (e) {
      next(e);
    }
  },

  /**
   * Get a random 1-of-1 edition collectible by Collection ID for interservice communication
   * This endpoint returns a collectible regardless of its status (including UNCONFIRMED)
   * It requires API key authentication instead of user authentication
   */
  getRandomOOOEditionCollectibleByCollectionIdForService: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // The apiKeyAuth middleware already validated the API key
      const { collectionId } = req.params;
      const { trait } = req.query;
      if (!collectionId) {
        throw new CustomError("Collectible ID is required", 400);
      }

      // Get the collectible regardless of status
      const selectedCollectible =
        await collectibleRepository.getRandomOOOEditionItemByCollectionId(
          collectionId
        );
      if (!selectedCollectible)
        return res.status(200).json({ success: true, data: null });

      const collectible = await collectibleRepository.setShortHoldById(
        selectedCollectible.id
      );
      if (!collectible)
        return res.status(200).json({ success: true, data: null });

      return res.status(200).json({
        success: true,
        data: selectedCollectible
      });
    } catch (e) {
      next(e);
    }
  },

  /**
   * Get a random recursive collectible by Collection ID for interservice communication
   * This endpoint returns a collectible regardless of its status (including UNCONFIRMED)
   * It requires API key authentication instead of user authentication
   */
  getRandomRecursiveCollectibleByCollectionIdForService: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // The apiKeyAuth middleware already validated the API key
      const { collectionId } = req.params;
      const { trait } = req.query;
      if (!collectionId) {
        throw new CustomError("Collectible ID is required", 400);
      }

      // Get the collectible regardless of status
      const selectedCollectible =
        await collectibleRepository.getRandomRecursiveItemByCollectionId(
          collectionId
        );
      if (!selectedCollectible)
        return res.status(200).json({ success: true, data: null });

      const collectible = await collectibleRepository.setShortHoldById(
        selectedCollectible.id
      );
      if (!collectible)
        return res.status(200).json({ success: true, data: null });

      return res.status(200).json({
        success: true,
        data: selectedCollectible
      });
    } catch (e) {
      next(e);
    }
  },

  /**
   * Get collectibles with no CID by collection ID and enqueue them to the queue processor
   * @param req Request object containing collection ID
   * @param res Response object
   * @param next Next function
   */
  getCollectiblesWithNoCidAndEnqueue: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectionId } = req.params;
      // Limit the number of collectibles that can be processed in one batch
      const MAX_BATCH_SIZE = 250; // Maximum number of collectibles to process at once
      const QUEUE_BATCH_SIZE = 50; // Send to queue processor in batches of 50
      const limit = Math.min(
        Number(req.query.limit) || DEFAULT_LIMIT,
        MAX_BATCH_SIZE
      );
      const offset = Number(req.query.offset) || 0;

      if (!collectionId) {
        throw new CustomError("Collection ID is required", 400);
      }

      // Check if the user has permission to access this collection
      const collection = await collectionRepository.getById(db, collectionId);
      if (!collection) {
        throw new CustomError("Collection not found", 404);
      }

      // // Check if the authenticated user owns this collection
      // // Note: We're using creatorId which is the actual field name in the Collection table
      // if (collection.creatorId !== req.user?.id) {
      //   throw new CustomError('You do not have permission to access this collection', 403);
      // }

      // Get collectibles with no CID for the collection
      const collectibles =
        await collectibleRepository.getCollectiblesWithNoCidByCollectionId(
          collectionId,
          offset,
          limit
        );

      // If no collectibles found, return empty array
      if (!collectibles.length) {
        return res.status(200).json({
          success: true,
          data: {
            collectibles: [],
            total: 0,
            message: "No collectibles with missing CID found"
          }
        });
      }

      // Check if queue processor service URL is configured
      if (!config.QUEUE_PROCESSOR_URL || !config.QUEUE_PROCESSOR_API_KEY) {
        logger.error("Queue processor service configuration is missing");
        throw new CustomError(
          "Queue processor service configuration is missing",
          500
        );
      }

      // Filter out collectibles with no fileKey
      const validCollectibles = collectibles.filter((collectible) => {
        if (!collectible.fileKey) {
          logger.warn(`Collectible ${collectible.id} has no fileKey, skipping`);
          return false;
        }
        return true;
      });

      // Split collectibles into batches of QUEUE_BATCH_SIZE
      const batches = [];
      for (let i = 0; i < validCollectibles.length; i += QUEUE_BATCH_SIZE) {
        batches.push(validCollectibles.slice(i, i + QUEUE_BATCH_SIZE));
      }

      // Process each batch
      const batchResults: Array<{
        collectibleId: string;
        success: boolean;
        message: string;
        jobId?: string | null;
      }> = [];
      for (const batch of batches) {
        try {
          const batchItems = batch.map((collectible) => ({
            collectibleId: collectible.id,
            fileKey: collectible.fileKey,
            collectionId: collectible.collectionId
          }));

          // Enqueue batch to queue processor service
          const response = await axios.post(
            `${config.QUEUE_PROCESSOR_URL}/api/queue`,
            {
              items: batchItems,
              queueType: "ipfs_upload"
            },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.QUEUE_PROCESSOR_API_KEY}`
              }
            }
          );

          // Record success for each collectible in the batch
          const jobIds = response.data.jobIds || [];
          batch.forEach((collectible, index) => {
            batchResults.push({
              collectibleId: collectible.id,
              success: true,
              message: "Enqueued successfully",
              jobId: jobIds[index] || null
            });
          });

          logger.info(
            `Successfully enqueued batch of ${batch.length} collectibles`
          );
        } catch (error: any) {
          logger.error(`Error enqueueing batch:`, error);
          // Record failure for each collectible in the batch
          batch.forEach((collectible) => {
            batchResults.push({
              collectibleId: collectible.id,
              success: false,
              message: error?.message || "Failed to enqueue batch"
            });
          });
        }
      }

      // Add results for collectibles with no fileKey
      const invalidResults = collectibles
        .filter((collectible) => !collectible.fileKey)
        .map((collectible) => ({
          collectibleId: collectible.id,
          success: false,
          message: "No fileKey available"
        }));

      const enqueueResults = [...batchResults, ...invalidResults];

      // Count successful enqueues
      const successCount = enqueueResults.filter(
        (result) => result.success
      ).length;

      return res.status(200).json({
        success: true,
        data: {
          collectibles,
          total: collectibles.length,
          enqueuedCount: successCount,
          enqueueResults,
          message: `Found ${collectibles.length} collectibles with missing CID, successfully enqueued ${successCount}`
        }
      });
    } catch (e) {
      next(e);
    }
  },
  createRecursiveCollectible: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectibleId } = req.params;
      const { inscriptionId, lockingAddress, lockingPrivateKey } = req.body;

      if (!inscriptionId) {
        throw new CustomError(
          "inscriptionId is required in the request body",
          400
        );
      }

      if (!lockingAddress) {
        throw new CustomError(
          "lockingAddress is required in the request body",
          400
        );
      }

      if (!lockingPrivateKey) {
        throw new CustomError(
          "lockingPrivateKey is required in the request body",
          400
        );
      }

      const result = await collectibleServices.createRecursiveCollectible(
        collectibleId,
        inscriptionId,
        lockingAddress,
        lockingPrivateKey
      );

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (e) {
      next(e);
    }
  },

  buildNftImageFromTraits: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectibleId } = req.params;
      if (!collectibleId) {
        throw new CustomError("Collectible ID is required", 400);
      }

      console.log(
        `started building collectible ${collectibleId} at ${new Date().toISOString()}`
      );

      const collectible = await collectibleRepository.getById(
        db,
        collectibleId
      );
      if (!collectible) throw new CustomError("Collectible not found", 400);

      const collection = await collectionRepository.getById(
        db,
        collectible.collectionId
      );
      if (!collection) throw new CustomError("Collection not found", 400);
      // No need to check authorization for service-to-service calls
      // as they are already authenticated via API key

      // 1. Fetch traits (must be sorted by zIndex in ascending order)
      const traits =
        await collectibleTraitRepository.getCollectibleTraitsWithDetails(
          collectibleId
        );

      if (!traits.length) {
        throw new CustomError("No traits found for this collectible", 404);
      }

      const normalizedTraitImages: Buffer[] = [];

      // 2. Load base image and extract canvas size
      const baseTrait = traits[0];
      if (!baseTrait.traitValue.fileKey) {
        throw new CustomError("Base trait image missing fileKey", 400);
      }

      const baseImageData = await getObjectFromS3(baseTrait.traitValue.fileKey);
      const baseBuffer = Buffer.from(baseImageData.content as string, "base64");

      const CANVAS_SIZE = {
        width: collection.recursiveWidth ?? 600,
        height: collection.recursiveHeight ?? 600
      };

      // Normalize base image to canvas
      const baseNormalized = await sharp({
        create: {
          width: CANVAS_SIZE.width,
          height: CANVAS_SIZE.height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
        .composite([{ input: baseBuffer, top: 0, left: 0 }])
        .png()
        .toBuffer();

      normalizedTraitImages.push(baseNormalized);

      // 3. Process and normalize the rest of the traits
      for (let i = 1; i < traits.length; i++) {
        const trait = traits[i];
        if (!trait.traitValue.fileKey) {
          logger.warn(`No fileKey found for trait ${trait.id}`);
          continue;
        }

        try {
          const imageData = await getObjectFromS3(trait.traitValue.fileKey);
          const buffer = Buffer.from(imageData.content as string, "base64");

          const normalized = await sharp({
            create: {
              width: CANVAS_SIZE.width,
              height: CANVAS_SIZE.height,
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0 }
            }
          })
            .composite([{ input: buffer, top: 0, left: 0 }])
            .png()
            .toBuffer();

          normalizedTraitImages.push(normalized);
        } catch (err) {
          logger.error(
            `Failed to process trait image ${trait.traitValue.fileKey}:`,
            err
          );
        }
      }

      if (normalizedTraitImages.length === 0) {
        throw new CustomError("No valid trait images found", 404);
      }

      // 4. Composite all layers into a final image
      let finalImage = sharp({
        create: {
          width: CANVAS_SIZE.width,
          height: CANVAS_SIZE.height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      });

      finalImage = finalImage.composite(
        normalizedTraitImages.map((buffer) => ({
          input: buffer,
          blend: "over"
        }))
      );

      const finalBuffer = await finalImage.png().toBuffer();

      console.log(
        `finished building collectible ${collectibleId} at ${new Date().toISOString()}`
      );

      // Set response headers for image display
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Length", finalBuffer.length);

      // Return both the image and the fileKey
      return res.send(finalBuffer);
    } catch (e) {
      next(e);
    }
  },
  countWithoutParentAndNotOoo: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectionId } = req.query;
      if (!collectionId) throw new CustomError("collectionId not found", 400);

      const count = await collectibleRepository.countWithoutParentAndNotOoo(
        collectionId as string
      );

      return res.status(200).json({ success: true, data: { count } });
    } catch (e) {
      next(e);
    }
  },
  countWithoutParent: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectionId } = req.query;
      if (!collectionId) throw new CustomError("collectionId not found", 400);

      const count = await collectibleRepository.countWithoutParent(
        collectionId as string
      );

      return res.status(200).json({ success: true, data: { count } });
    } catch (e) {
      next(e);
    }
  },
  getCollectibleByUniqueIdxAndLayerIdForService: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // The apiKeyAuth middleware already validated the API key
      const { uniqueIdx } = req.params;
      if (!uniqueIdx) {
        throw new CustomError("uniqueIdx is required", 400);
      }

      const { layerId } = req.query;
      if (!layerId) throw new CustomError("Please provide the layer id", 400);

      const collectible =
        await collectibleRepository.getCollectibleByUniqueIdxAndLayerIdForService(
          uniqueIdx,
          layerId.toString()
        );

      return res.status(200).json({
        success: true,
        data: collectible
      });
    } catch (e) {
      next(e);
    }
  },
  createL2OnlyCollectible: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { fileKey, collectionId, name, uniqueIdx, nftId, status } =
        req.body;

      if (!fileKey || !collectionId || !name || !uniqueIdx || !nftId)
        throw new CustomError("Invalid input", 400);

      if (
        (status as COLLECTIBLE_STATUS) !== "BURNED" &&
        (status as COLLECTIBLE_STATUS) !== "CONFIRMED"
      )
        throw new CustomError("Invalid status", 400);

      const result = await collectibleRepository.create(db, {
        name,
        nftId,
        uniqueIdx,
        fileKey,
        collectionId,
        status
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (e) {
      next(e);
    }
  },
  markCollectibleAsBurnedByCollectibleId: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectibleId } = req.params;

      const collectible = await collectibleRepository.update(
        db,
        collectibleId,
        {
          status: "BURNED"
        }
      );
      if (!collectible) throw new CustomError("Collectible not found", 400);

      return res.status(200).json({ success: true, data: collectible });
    } catch (e) {
      next(e);
    }
  }
};
