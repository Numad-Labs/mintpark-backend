import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest, tokenData } from "../../custom";
import { Insertable } from "kysely";
import { Collectible } from "../types/db/types";
import { collectibleServices } from "../services/collectibleServices";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { CustomError } from "../exceptions/CustomError";
import { mintForAnduroWallet } from "../libs/coordinate/mint";
import { FEE_RATE, SERVICE_FEE_ADDRESS } from "../libs/constants";

export const collectibleController = {
  mint: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user)
        throw new CustomError("Could not retrieve id from the token", 400);

      const { payload, ticker, headline, supply, assetType } = req.body;

      const collectible: tokenData = {
        address: null,
        xpub: req.user.xpub,
        opReturnValues: payload,
        assetType: assetType,
        headline: headline,
        ticker: ticker,
        supply: supply,
      };

      const txHex = await mintForAnduroWallet(
        collectible,
        SERVICE_FEE_ADDRESS,
        10000,
        FEE_RATE
      );

      return res.status(200).json({
        success: true,
        data: {
          hex: txHex.hex,
        },
      });
    } catch (e) {
      next(e);
    }
  },
  create: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const data: Insertable<Collectible>[] = JSON.parse(req.body.data);
    const files = req.files as Express.Multer.File[];

    try {
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token", 400);

      if (!files) throw new CustomError("Please provide the files", 400);

      if (files.length !== data.length)
        throw new CustomError("Different number of file and input", 400);

      if (files.length > 10)
        throw new CustomError(
          "Batch upload file count cannot be more than 10",
          400
        );

      const collectibles = await collectibleServices.create(
        data,
        files,
        req.user.id
      );

      return res.status(200).json({ success: true, data: collectibles });
    } catch (e) {
      next(e);
    }
  },
  getById: async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    try {
      const collectible = await collectibleRepository.getById(id);

      return res.status(200).json({ success: true, data: collectible });
    } catch (e) {
      next(e);
    }
  },
  getByCollectionId: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const { collectionId } = req.params;
    try {
      const collectibles = await collectibleRepository.getByCollectionId(
        collectionId
      );

      return res.status(200).json({ success: true, data: collectibles });
    } catch (e) {
      next(e);
    }
  },
};
