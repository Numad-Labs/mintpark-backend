import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../../custom";
import { CustomError } from "../exceptions/CustomError";
import { collectibleServices } from "../services/collectibleServices";
import { collectibleRepository } from "../repositories/collectibleRepository";

export interface traitFilter {
  name: string;
  value: string;
}

type OrderByOption = "price" | "recent";
type OrderDirectionOption = "asc" | "desc";

export interface CollectibleQueryParams {
  orderBy?: OrderByOption;
  orderDirection?: OrderDirectionOption;
  isListed: boolean;
  collectionIds?: string[];
  traits?: string[];
}

export const collectibleControllers = {
  getListableCollectibles: async (
    req: Request<{ userId: string }, {}, {}, CollectibleQueryParams>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { isListed = false, orderBy, orderDirection } = req.query;
      const collectionIds = req.query.collectionIds as string[];
      const { userId } = req.params;

      if (!userId) throw new CustomError("userId not found.", 400);

      const result = await collectibleServices.getListableCollectibles(userId, {
        isListed,
        orderBy,
        orderDirection,
        collectionIds,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (e) {
      next(e);
    }
  },
  getListableCollectiblesByCollectionId: async (
    req: Request<{ collectionId: string }, {}, {}, CollectibleQueryParams>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectionId } = req.params;
      const { orderBy, orderDirection, isListed = false } = req.query;
      const traits: string[] = req.query.traits as string[];

      const result =
        await collectibleServices.getListableCollectiblesByCollectionId(
          collectionId,
          {
            orderBy,
            orderDirection,
            isListed,
            traits,
          }
        );

      return res.status(200).json({
        success: true,
        data: {
          collectibles: result.listableCollectibles,
          listedCollectibleCount: result.activeListCount,
        },
      });
    } catch (e) {
      next(e);
    }
  },
  getCollectibleById: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      const listableCollectibles =
        await collectibleRepository.getByIdWithDetails(id);

      return res
        .status(200)
        .json({ success: true, data: listableCollectibles });
    } catch (e) {}
  },
};
