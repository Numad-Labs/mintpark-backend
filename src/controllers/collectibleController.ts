import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../../custom";
import { CustomError } from "../exceptions/CustomError";
import { collectibleServices } from "../services/collectibleServices";
import { collectibleRepository } from "../repositories/collectibleRepository";

export const collectibleControllers = {
  getListableCollectibles: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;

      if (!userId) throw new CustomError("userId not found.", 400);

      const listableCollectibles =
        await collectibleServices.getListableCollectibles(userId);

      return res
        .status(200)
        .json({ success: true, data: listableCollectibles });
    } catch (e) {}
  },
  /*
    get collectibles(minted) by collectionId
    filterable by traits(can be multiple)
    orderable by (Highest/Lowest price, Recently listed)
    searchable by uniqueId?
    fields: name, price, status(listed or not), floorDiff, listedTime
  */
  getListableCollectiblesByCollectionId: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectionId } = req.params;
      const { traits, orderBy, search, page = 1, limit = 20 } = req.query;

      const listableCollectibles =
        await collectibleRepository.getListableCollectiblesByCollectionId(
          collectionId
        );

      return res
        .status(200)
        .json({ success: true, data: listableCollectibles });
    } catch (e) {}
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
