import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../../custom";
import { CustomError } from "../exceptions/CustomError";
import { collectibleServices } from "../services/collectibleServices";
import { collectibleRepository } from "../repositories/collectibleRepository";
import logger from "../config/winston";
import { z } from "zod";
import { collectionRepository } from "@repositories/collectionRepository";
import { db } from "@utils/db";
import subgraphService from "@blockchain/evm/services/subgraph/subgraphService";
import { LAYER } from "@app-types/db/enums";
import { sql } from "kysely";
import axios from "axios";
import { config } from "@config/config";

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
        sortDirection = "desc"
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

      // Get collection address from repository by collection ID
      const collection = await collectionRepository.getById(db, collectionId);

      if (!collection) {
        throw new CustomError("Collection not found", 404);
      }

      const collectionAddress = collection.contractAddress;

      if (!collectionAddress)
        throw new CustomError("Collection address not found", 400);

      const result = await subgraphService.getCollectionActivity(
        layer,
        numericChainId,
        collectionAddress,
        {
          limit: parseInt(limit as string) || 20,
          offset: parseInt(offset as string) || 0,
          sortBy: sortBy as string,
          sortDirection: ((sortDirection as string) || "desc") as "asc" | "desc"
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
              fileKey: collectible.fileKey
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
              fileKey: collectibleData?.fileKey || null
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
      const { collectibleId, ipfsUri } = req.body;

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

      // If the collectible already has CID, return success without updating
      // This makes the endpoint idempotent
      if (existingCollectible.cid) {
        logger.info(
          `Collectible ${collectibleId} already has CID, no update needed`
        );
        return res.status(200).json({
          success: true,
          data: {
            id: existingCollectible.id,
            cid: existingCollectible.cid,
            alreadyHadCid: true
          }
        });
      }

      // Update the collectible with the CID
      const updatedCollectible =
        await collectibleServices.updateCollectibleIpfs(collectibleId, ipfsUri);

      return res.status(200).json({
        success: true,
        data: {
          id: updatedCollectible.id,
          cid: updatedCollectible.cid,
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
  }
};
