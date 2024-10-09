import { NextFunction, Request, Response } from "express";
import { Collection } from "../types/db/types";
import { Insertable } from "kysely";
import { collectionServices } from "../services/collectionServices";
import { AuthenticatedRequest } from "../../custom";
import { collectionRepository } from "../repositories/collectionRepository";
import { CustomError } from "../exceptions/CustomError";
import { LAYER_TYPE } from "@prisma/client";

export const collectionController = {
  create: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const data: Insertable<Collection> = { ...req.body };
    const logo = req.file as Express.Multer.File;

    try {
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);

      data.price = Number(data.price);

      const collection = await collectionServices.create(
        data,
        logo,
        req.user.address
      );

      return res.status(200).json({ success: true, data: collection });
    } catch (e) {
      next(e);
    }
  },
  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const collections = await collectionRepository.get();

      return res.status(200).json({ success: true, data: collections });
    } catch (e) {
      next(e);
    }
  },
  getById: async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    try {
      const collection = await collectionRepository.getById(id);

      return res.status(200).json({ success: true, data: collection });
    } catch (e) {
      next(e);
    }
  },
  getByLayerType: async (req: Request, res: Response, next: NextFunction) => {
    const layerType = req.query.layerType;
    if (!layerType) throw new CustomError("Please provide a layer type.", 400);

    try {
      const collections = await collectionRepository.getByLayerType(
        layerType as LAYER_TYPE
      );

      return res.status(200).json({ success: true, data: collections });
    } catch (e) {
      next(e);
    }
  },
};
