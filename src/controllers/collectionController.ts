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

export interface updateCollection {
  name?: string;
  creator?: string;
  description?: string;
  discordUrl?: string;
  twitterUrl?: string;
  webUrl?: string;
  slug?: string;
  logoKey?: string;
}

export const collectionController = {
  create: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const userId = req.user?.id;
    const { name, creator, description, priceForLaunchpad } = req.body;
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
      if (!userId) throw new CustomError("Cannot parse user from token", 401);
      if (!name || !description)
        throw new CustomError("Name and description are required.", 400);

      const result = await collectionServices.create(
        data,
        userId,
        name,
        priceForLaunchpad,
        logo
      );
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
      totalFileCount,
    } = req.body;
    const { collectionId } = req.params;
    const files = req.files as Express.Multer.File[];

    try {
      if (!POStartsAt || !POMintPrice || !POMaxMintPerWallet || !isWhiteListed)
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
      if ((POEndsAt && POStartsAt > POEndsAt) || WLStartsAt < WLEndsAt) {
        throw new CustomError("Start date must be before end date", 400);
      }
      if (!req.user?.id)
        throw new CustomError("Could not parse the id from the token.", 401);

      const launch = await launchServices.create(
        {
          collectionId,
          poStartsAt: BigInt(POStartsAt),
          poEndsAt: BigInt(POEndsAt),
          poMintPrice: POMintPrice,
          poMaxMintPerWallet: POMaxMintPerWallet,
          isWhitelisted: isWhiteListed,
          wlStartsAt: WLStartsAt ? BigInt(WLStartsAt) : null,
          wlEndsAt: WLEndsAt ? BigInt(WLEndsAt) : null,
          wlMaxMintPerWallet: WLMaxMintPerWallet || null,
          wlMintPrice: WLMintPrice || null,
          ownerId: req.user.id,
        },
        files,
        totalFileCount,
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
  update: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { id } = req.params;
    const { name, creator, description, discordUrl, twitterUrl, webUrl, slug } =
      req.body;
    const logo = req.file as Express.Multer.File;

    try {
      if (!req.user?.id)
        throw new CustomError("Could not parse the id from the token.", 401);

      const collection = await collectionServices.update(
        id,
        { name, creator, description, discordUrl, twitterUrl, webUrl, slug },
        logo,
        req.user.id
      );

      return res.status(200).json({ success: true, data: { collection } });
    } catch (e) {
      next(e);
    }
  },
  listForEvm: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { contractAddress } = req.body;

    try {
      if (!req.user?.id)
        throw new CustomError("Could not parse the id from the token.", 401);

      const result = await collectionServices.listForEvm(
        contractAddress,
        req.user.id
      );

      return res.status(200).json({ success: true, data: { result } });
    } catch (e) {
      next(e);
    }
  },
};
