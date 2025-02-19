import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../../custom";
import { CustomError } from "../exceptions/CustomError";
import { collectibleServices } from "../services/collectibleServices";
import { collectibleRepository } from "../repositories/collectibleRepository";
import logger from "../config/winston";

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

export const collectibleControllers = {
  getListableCollectibles: async (
    req: Request,
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
  getTokenActivity: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { collectibleId } = req.params;
      const { fromBlock } = req.query;
      if (!collectibleId) {
        throw new CustomError("collectibleId is required", 400);
      }

      // const activities = await collectibleServices.getActivityByCollectibleId(
      //   collectibleId
      // );

      res.status(200).json({
        success: true,
        data: []
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
      console.log(req.body.data);
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
  }
};
