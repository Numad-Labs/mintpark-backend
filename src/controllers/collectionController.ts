import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../custom";
import { collectionServices } from "../services/collectionServices";
import { Collection } from "../types/db/types";
import { CustomError } from "../exceptions/CustomError";

export const collectionController = {
  create: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { name, creator, description } = req.body;
    if (!name || !description)
      throw new CustomError("Name and description are required.", 400);
    const logo = req.file as Express.Multer.File;
    const data = {
      name,
      creator,
      description,
      supply: 0,
      logoKey: null,
    };
    try {
      const collection = await collectionServices.create(data, logo);
      return res.status(200).json({ success: true, data: collection });
    } catch (e) {
      next(e);
    }
  },
  getById: async (req: Request, res: Response, next: NextFunction) => {
    const { collectionId } = req.params;
    try {
      const collection = await collectionServices.getById(collectionId);
      if (!collection) throw new CustomError("Collection not found", 404);
      return res.status(200).json({ success: true, data: collection });
    } catch (e) {
      next(e);
    }
  },
  getAllLaunchedCollections: async () => {
    const collections = await collectionServices.getAllLaunchedCollections();
    return collections;
  }
};
