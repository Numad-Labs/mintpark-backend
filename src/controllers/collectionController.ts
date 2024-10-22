import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../custom";
import { collectionServices } from "../services/collectionServices";
import { CustomError } from "../exceptions/CustomError";
import { launchServices } from "../services/launchServices";
import { collectionRepository } from "../repositories/collectionRepository";

export interface CollectionQueryParams {
  layerId: string;
  interval: "1h" | "24h" | "7d" | "30d" | "all";
  orderBy?: "volume" | "floor";
  orderDirection?: "highest" | "lowest";
  // page?: string;
  // pageSize?: string;
}

export const collectionController = {
  create: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const userId = req.user?.id;
    if (!userId) throw new CustomError("Cannot parse user from token", 401);
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
      layerId: null,
    };
    try {
      const result = await collectionServices.create(data, userId, name, logo);
      return res.status(200).json({
        success: true,
        data: {
          collection: result.collection,
          deployContractTxHex: result.deployContractTxHex,
        },
      });
    } catch (e) {
      next(e);
    }
  },
  launchCollection: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const {
      POStartsAt,
      POEndsAt,
      POMintPrice,
      POMaxMintPerWallet,
      isWhiteListed,
      WLStartsAt,
      WLEndsAt,
      WLMintPrice,
      WLMaxMintPerWallet,
      txid,
    } = req.body;
    const { collectionId } = req.params;
    try {
      const files = req.files as Express.Multer.File[];
      if (
        !POStartsAt ||
        !POEndsAt ||
        !POMintPrice ||
        !POMaxMintPerWallet ||
        !isWhiteListed
      )
        throw new CustomError(
          "Please provide all required fields. (POStartsAt, POEndsAt, POMintPrice, POMaxMintPerWallet, isWhiteListed)",
          400
        );
      if (
        isWhiteListed === "true" &&
        (!WLStartsAt || !WLEndsAt || !WLMintPrice || !WLMaxMintPerWallet)
      )
        throw new CustomError(
          "Please provide all required fields for white listed collection. (WLStartsAt, WLEndsAt, WLMintPrice, WLMaxMintPerWallet)",
          400
        );
      const currentTime = new Date();
      const POStartsAtTime = new Date(
        currentTime.getTime() + Number(POStartsAt)
      );
      const POEndsAtTime = new Date(currentTime.getTime() + Number(POEndsAt));

      const launch = await launchServices.create(
        {
          collectionId,
          poStartsAt: POStartsAtTime,
          poEndsAt: POEndsAtTime,
          poMintPrice: POMintPrice,
          poMaxMintPerWallet: POMaxMintPerWallet,
          isWhitelisted: isWhiteListed,
          wlStartsAt: WLStartsAt
            ? new Date(currentTime.getTime() + Number(WLStartsAt))
            : null,
          wlEndsAt: WLEndsAt
            ? new Date(currentTime.getTime() + Number(WLEndsAt))
            : null,
          wlMaxMintPerWallet: WLMaxMintPerWallet || null,
          wlMintPrice: WLMintPrice || null,
        },
        files,
        txid
      );
      return res.status(200).json({ success: true, data: launch });
    } catch (e) {
      next(e);
    }
  },
  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const collection = await collectionRepository.getByIdWithDetails(id);
      if (!collection) throw new CustomError("Collection not found", 404);

      return res.status(200).json({ success: true, data: collection });
    } catch (e) {
      next(e);
    }
  },
  getListedCollections: async (
    req: Request<{}, {}, {}, CollectionQueryParams>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { layerId, interval, orderBy, orderDirection } = req.query;
      // const page = parseInt(req.query.page || "1", 10);
      // const pageSize = parseInt(req.query.pageSize || "10", 10);
      // const offset = (page - 1) * pageSize;

      if (!layerId) throw new CustomError("You must specify the layer.", 400);

      const result = await collectionServices.getListedCollections({
        layerId,
        interval,
        orderBy,
        orderDirection,
      });

      return res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  },
};
