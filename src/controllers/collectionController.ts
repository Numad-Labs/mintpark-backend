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
  websiteUrl?: string;
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
      isBadge
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
      isBadge: isBadge === "true"
    };

    try {
      if (!userId) throw new CustomError("Cannot parse user from token", 401);
      if (!name || !description)
        throw new CustomError("Name and description are required.", 400);
      // if (!logo) throw new CustomError("Logo file must be provided.", 400);
      if (!data.type) throw new CustomError("Invalid collection type.", 400);
      if (
        ![
          "SYNTHETIC",
          "IPFS_FILE",
          "IPFS_CID",
          "INSCRIPTION",
          "RECURSIVE_INSCRIPTION"
        ].includes(data.type)
      )
        throw new CustomError("Invalid collection type.", 400);

      const { ordinalCollection, l2Collection, deployContractTxHex } =
        await collectionServices.create(
          data,
          name,
          priceForLaunchpad,
          userId,
          userLayerId,
          logo
        );

      return res.status(200).json({
        success: true,
        data: {
          ordinalCollection,
          l2Collection,
          deployContractTxHex: deployContractTxHex
        }
      });
    } catch (e) {
      next(e);
    }
  },

  addPhase: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user?.id;

      if (!userId) throw new CustomError("Cannot parse user from token", 401);

      const {
        collectionId,
        phaseType,
        price,
        startTime,
        endTime,
        maxSupply,
        maxPerWallet,
        merkleRoot,
        layerId,
        userLayerId
      } = req.body;

      // Validate required fields
      if (!collectionId)
        throw new CustomError("Collection ID is required", 400);
      if (phaseType === undefined)
        throw new CustomError("Phase type is required", 400);
      if (!startTime || !endTime)
        throw new CustomError("Start and end times are required", 400);
      if (!layerId) throw new CustomError("Layer ID is required", 400);

      // Validate time range
      if (startTime >= endTime) {
        throw new CustomError("End time must be after start time", 400);
      }

      // Validate phase type
      if (![0, 1, 2].includes(phaseType)) {
        // 1: Whitelist, 2: FCFS,  3:Public
        throw new CustomError("Invalid phase type", 400);
      }

      // Validate numbers
      if (maxPerWallet < 0 || maxSupply < 0) {
        throw new CustomError("Invalid supply or wallet limit values", 400);
      }

      const unsignedTx = await collectionServices.addPhase(
        {
          collectionId,
          phaseType,
          price,
          startTime,
          endTime,
          maxSupply,
          maxPerWallet,
          merkleRoot,
          layerId,
          userId,
          userLayerId
        },
        userId
      );

      return res.status(200).json({
        success: true,
        data: {
          unsignedTx
        }
      });
    } catch (error) {
      next(error);
    }
  },

  updatePhase: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user?.id;

      if (!userId) throw new CustomError("Cannot parse user from token", 401);

      const {
        launchId,
        phaseIndex,
        phaseType,
        price,
        startTime,
        endTime,
        maxSupply,
        maxPerWallet,
        merkleRoot,
        userLayerId
      } = req.body;

      // Validate required fields
      if (!launchId) throw new CustomError("Launch ID is required", 400);
      if (phaseIndex === undefined)
        throw new CustomError("Phase index is required", 400);
      if (phaseType === undefined)
        throw new CustomError("Phase type is required", 400);
      if (!startTime || !endTime)
        throw new CustomError("Start and end times are required", 400);

      // Validate time range
      if (startTime >= endTime) {
        throw new CustomError("End time must be after start time", 400);
      }

      // Validate phase type
      if (![0, 1, 2].includes(phaseType)) {
        // 1: Whitelist, 2: Public
        throw new CustomError("Invalid phase type", 400);
      }

      // Validate numbers
      if (maxPerWallet < 0 || maxSupply < 0 || phaseIndex < 0) {
        throw new CustomError("Invalid numeric values", 400);
      }

      const result = await collectionServices.updatePhase(
        {
          launchId,
          phaseIndex,
          phaseType,
          price,
          startTime,
          endTime,
          maxSupply,
          maxPerWallet,
          merkleRoot,
          userLayerId
        },
        userId
      );

      return res.status(200).json({
        success: true,
        data: {
          unsignedTx: result.unsignedTx,
          updateId: result.updateId
        }
      });
    } catch (error) {
      next(error);
    }
  },
  confirmUpdatePhase: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user?.id;

      if (!userId) throw new CustomError("Cannot parse user from token", 401);

      const { updateId, txid, userLayerId } = req.body;

      // Validate required fields
      if (!updateId) throw new CustomError("Update ID is required", 400);
      if (!txid) throw new CustomError("Transaction ID is required", 400);

      const result = await collectionServices.confirmUpdatePhase(
        {
          updateId,
          txid,
          userLayerId
        },
        userId
      );

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
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
  getPhasesByContractAddress: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user?.id;
      const { collectionId, userLayerId } = req.query;

      if (!collectionId) throw new CustomError("Missing collectionId", 400);
      if (!userLayerId) throw new CustomError("Missing userLayerId", 400);
      if (!userId) throw new CustomError("Missing userId", 400);

      const phases = await collectionServices.getPhasesByContractAddress(
        collectionId.toString(),
        userLayerId.toString(),
        userId
      );
      if (!phases) throw new CustomError("Phase not found", 404);

      return res.status(200).json({ success: true, data: phases });
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
        orderDirection
      });

      return res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  },
  updateDetails: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const { description, discordUrl, twitterUrl, websiteUrl } = req.body;

      if (!userId) throw new CustomError("Cannot parse user from token", 401);
      if (!id) throw new CustomError("Collection ID is required", 400);

      // Check if at least one field to update is provided
      if (!description && !discordUrl && !twitterUrl && !websiteUrl) {
        throw new CustomError(
          "At least one field to update must be provided",
          400
        );
      }

      const updatedCollection = await collectionServices.updateDetails(
        id,
        {
          description,
          discordUrl,
          twitterUrl,
          websiteUrl
        },
        userId
      );

      return res.status(200).json({
        success: true,
        data: updatedCollection
      });
    } catch (error) {
      next(error);
    }
  }

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
