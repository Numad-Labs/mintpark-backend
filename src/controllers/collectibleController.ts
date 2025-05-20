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

export interface recursiveInscriptionParams {
  name: string;
  traits: { type: string; value: string }[];
}

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
  createInscriptionInBatch: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Could not parse the id from the token.", 400);

      const { collectionId } = req.body;
      const files: Express.Multer.File[] = req.files as Express.Multer.File[];

      if (files.length === 0)
        throw new CustomError("Please provide the files.", 400);
      if (files.length > 10)
        throw new CustomError("You cannot provide more than 10 files.", 400);

      const result =
        await collectibleServices.createInscriptionAndOrderItemInBatch(
          req.user.id,
          collectionId,
          files
        );

      return res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  },
  createRecursiveInscriptionInBatch: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Could not parse the id from the token.", 400);

      const { collectionId } = req.body;
      const data: recursiveInscriptionParams[] = Array.isArray(req.body.data)
        ? req.body.data
        : req.body.data
          ? [req.body.data]
          : [];
      if (data.length === 0)
        throw new CustomError("Please provide the data.", 400);
      if (data.length > 10)
        throw new CustomError(
          "You cannot provide more than 10 elements of data.",
          400
        );

      const result =
        await collectibleServices.createRecursiveInscriptionAndOrderItemInBatch(
          req.user.id,
          collectionId,
          data
        );

      return res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  },
  createIpfsNftInBatch: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Could not parse the id from the token.", 400);

      const { collectionId } = req.body;
      const data: ipfsData = Array.isArray(req.body.data)
        ? req.body.data
        : req.body.data
          ? [req.body.data]
          : [];
      // if (data.length === 0)
      //   throw new CustomError("Please provide the data.", 400);
      // if (data.length > 10)
      //   throw new CustomError(
      //     "You cannot provide more than 10 elements of data.",
      //     400
      //   );

      const result = await collectibleServices.createIpfsNftAndOrderItemInBatch(
        req.user.id,
        collectionId,
        data
      );

      return res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  },
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

      await collectibleServices.insertTraits(collectionId, data);

      return res.status(200).json({ success: true });
    } catch (e) {
      next(e);
    }
  }
};
