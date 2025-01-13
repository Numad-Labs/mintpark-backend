import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../custom";
import { collectionServices } from "../services/collectionServices";
import { CustomError } from "../exceptions/CustomError";
import { launchServices } from "../services/launchServices";
import { collectionRepository } from "../repositories/collectionRepository";
import { Insertable } from "kysely";
import { Collection } from "../types/db/types";

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
    const {
      name,
      creator,
      description,
      priceForLaunchpad,
      layerId,
      userLayerId,
      type,
    } = req.body;
    const logo = req.file as Express.Multer.File;
    const data: Insertable<Collection> = {
      name,
      creatorName: creator,
      description,
      supply: 0,
      logoKey: null,
      layerId,
      type,
    };

    try {
      if (!userId) throw new CustomError("Cannot parse user from token", 401);
      if (!name || !description)
        throw new CustomError("Name and description are required.", 400);
      if (!logo) throw new CustomError("Logo file must be provided.", 400);
      if (!data.type) throw new CustomError("Invalid collection type.", 400);
      if (
        ![
          "SYNTHETIC",
          "IPFS_FILE",
          "IPFS_CID",
          "INSCRIPTION",
          "RECURSIVE_INSCRIPTION",
        ].includes(data.type)
      )
        throw new CustomError("Invalid collection type.", 400);

      const { ordinalCollection, l2Collection, deployContractTxHex } =
        await collectionServices.create(
          data,
          name,
          priceForLaunchpad,
          logo,
          userId,
          userLayerId
        );

      return res.status(200).json({
        success: true,
        data: {
          ordinalCollection,
          l2Collection,
          deployContractTxHex: deployContractTxHex,
        },
      });
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
  // update: async (
  //   req: AuthenticatedRequest,
  //   res: Response,
  //   next: NextFunction
  // ) => {
  //   const { id } = req.params;
  //   const { name, creator, description, discordUrl, twitterUrl, webUrl, slug } =
  //     req.body;
  //   const logo = req.file as Express.Multer.File;

  //   try {
  //     if (!req.user?.id)
  //       throw new CustomError("Could not parse the id from the token.", 401);

  //     const collection = await collectionServices.update(
  //       id,
  //       { name, creator, description, discordUrl, twitterUrl, webUrl, slug },
  //       logo,
  //       req.user.id
  //     );

  //     return res.status(200).json({ success: true, data: { collection } });
  //   } catch (e) {
  //     next(e);
  //   }
  // },
  // listForEvm: async (
  //   req: AuthenticatedRequest,
  //   res: Response,
  //   next: NextFunction
  // ) => {
  //   const { contractAddress } = req.body;

  //   try {
  //     if (!req.user?.id)
  //       throw new CustomError("Could not parse the id from the token.", 401);

  //     const result = await collectionServices.listForEvm(
  //       contractAddress,
  //       req.user.id
  //     );

  //     return res.status(200).json({ success: true, data: { result } });
  //   } catch (e) {
  //     next(e);
  //   }
  // },
};
