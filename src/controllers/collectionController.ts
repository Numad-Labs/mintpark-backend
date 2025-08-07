import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../custom";
import { collectionServices } from "../services/collectionServices";
import { CustomError } from "../exceptions/CustomError";
import { launchServices } from "../services/launchServices";
import { collectionRepository } from "../repositories/collectionRepository";
import { Insertable } from "kysely";
import { Collection } from "../types/db/types";
import { db } from "@utils/db";
import { collectionProgressServices } from "@services/collectionProgressServices";
import { userLayerRepository } from "@repositories/userLayerRepository";
import { userRepository } from "@repositories/userRepository";
import { collectibleRepository } from "@repositories/collectibleRepository";
import { traitValueRepository } from "@repositories/traitValueRepository";
import { orderRepository } from "@repositories/orderRepostory";
import { collectionProgressRepository } from "@repositories/collectionProgressRepository";
import {
  isCollectionDone,
  isCollectionRanOutOfFunds,
  isCollectionRanOutOfFundsByOrderIds
} from "@queue/queueProcessServiceAPIs";
import { collectionUploadSessionRepository } from "@repositories/collectionUploadSessionRepository";
import logger from "@config/winston";

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
  getCreatorOwnedCollections: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const userId = req.user?.id;
    const { userLayerId, page, limit } = req.query;

    try {
      if (!userId) throw new CustomError("Cannot parse user from token", 401);
      if (!userLayerId)
        throw new CustomError("Please provide user layer id", 400);
      if (!page || !limit)
        throw new CustomError("Please provide pagination values", 400);

      const userLayer = await userRepository.getByUserLayerId(
        userLayerId.toString()
      );
      if (!userLayer) throw new CustomError("Invalid user layer id", 400);
      if (userLayer.id !== userId)
        throw new CustomError(
          "You are not allowed to do this for this user.",
          400
        );

      const collections = await collectionProgressServices.getByCreatorAddress(
        userLayer.address,
        Number(page),
        Number(limit)
      );

      return res.status(200).json({ success: true, data: collections });
    } catch (e) {
      next(e);
    }
  },
  getInscriptionProgress: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { userLayerId } = req.query;

    try {
      if (!userId) throw new CustomError("Cannot parse user from token", 401);
      if (!id) throw new CustomError("Please provide id", 400);
      if (!userLayerId)
        throw new CustomError("Please provide user layer id", 400);

      const userLayer = await userRepository.getByUserLayerId(
        userLayerId.toString()
      );
      if (!userLayer) throw new CustomError("Invalid user layer id", 400);
      if (userLayer.id !== userId)
        throw new CustomError(
          "You are not allowed to do this for this user.",
          400
        );

      const collection = await collectionRepository.getById(db, id);
      if (!collection) throw new CustomError("Collection not found", 400);

      const collectionProgress = await collectionProgressRepository.getById(id);
      if (!collectionProgress)
        throw new CustomError("Collection progress not found", 400);
      if (!collectionProgress.queued)
        throw new CustomError("Collection has not been queued.", 400);

      const order = await orderRepository.getByCollectionId(id);
      if (!order) throw new CustomError("Order not found", 400);

      const totalTraitValueCount =
        await traitValueRepository.getCountByCollectionId(id);
      const notDoneTraitValueCount =
        await traitValueRepository.getNotDoneCountByCollectionId(id);
      const doneTraitValueCount =
        Number(totalTraitValueCount) - Number(notDoneTraitValueCount);

      const totalCollectibleCount =
        await collectibleRepository.countAllByCollectionId(id);
      const notDoneCollectibleCount =
        await collectibleRepository.countWithoutParent(id);
      const doneCollectibleCount =
        Number(totalCollectibleCount) - Number(notDoneCollectibleCount);

      const inscriptionLimitPerBlock = 11;
      const blockTimeInMinutes = 10;

      const done = Number(doneTraitValueCount) + Number(doneCollectibleCount);
      const total =
        Number(totalTraitValueCount) + Number(totalCollectibleCount);

      if (done === total) {
        if (
          (await isCollectionDone(collection.id)) &&
          !collectionProgress.collectionCompleted
        ) {
          const collectionProgressData: {
            collectionCompleted: boolean;
            leftoverAmount?: number;
            leftoverClaimed?: boolean;
          } = { collectionCompleted: true };

          // TODO: do the leftover calculation, leftoverAmount = 0 -> leftoverAmount += getBalances of all addresses
          const leftoverAmount = 5000;
          if (leftoverAmount < 1000) {
            collectionProgressData.leftoverAmount = 0;
            collectionProgressData.leftoverClaimed = true;
          } else {
            collectionProgressData.leftoverAmount = leftoverAmount;
            collectionProgressData.leftoverClaimed = false;
          }

          await collectionProgressServices.update(collection.id, {
            ...collectionProgressData
          });
        }
      }

      const etaInMinutes = Math.max(
        ((notDoneTraitValueCount + notDoneCollectibleCount) /
          inscriptionLimitPerBlock /
          order.orderSplitCount) *
          blockTimeInMinutes,
        done !== total ? blockTimeInMinutes : 0
      );

      return res.status(200).json({
        success: true,
        data: {
          totalTraitValueCount,
          doneTraitValueCount,

          totalCollectibleCount: Number(totalCollectibleCount),
          doneCollectibleCount,

          done,
          total,
          etaInMinutes
        }
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
    const userId = req.user?.id;
    const {
      name,
      creator,
      description,
      priceForLaunchpad,
      layerId,
      userLayerId,
      type,
      isBadge,
      symbol
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
      isBadge: isBadge === "true",
      symbol
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
  submitLaunchForReview: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { id } = req.params;

    try {
      const userId = req.user?.id;
      if (!userId) throw new CustomError("Cannot parse user from token", 401);

      const result = await collectionServices.submitForReview(id, userId);

      return res.status(200).json({
        success: true,
        data: result
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
  getByIdForService: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      const collection = await collectionRepository.getByIdForService(db, id);
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
  },
  stopAndWithdraw: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      if (!userId) throw new CustomError("Cannot parse user from token", 401);
      if (!id) throw new CustomError("Collection ID is required", 400);

      const orders = await collectionServices.stopAndWithdraw(id, userId);

      return res.status(200).json({
        success: true,
        data: orders
      });
    } catch (error) {
      next(error);
    }
  },
  withdraw: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const { address } = req.body;
      if (!userId) throw new CustomError("Cannot parse user from token", 401);
      if (!id) throw new CustomError("Collection ID is required", 400);

      const txid = await collectionServices.withdraw(id, address, userId);

      return res.status(200).json({
        success: true,
        data: { txid }
      });
    } catch (error) {
      next(error);
    }
  },
  markAsRanOutOfFunds: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const { orderId } = req.params;

    try {
      const order = await orderRepository.getById(db, orderId);
      if (!order) throw new CustomError("Order not found", 400);
      if (!order.collectionId)
        throw new CustomError("Order with no collectionId", 400);

      const orders =
        await orderRepository.getOrdersByCollectionIdAndMintRecursiveCollectibleType(
          order.collectionId
        );
      const hasAllOrdersBeenMarkedAsOutOfFunds =
        await isCollectionRanOutOfFundsByOrderIds(
          orders.map((order) => order.id)
        );
      if (!hasAllOrdersBeenMarkedAsOutOfFunds)
        throw new CustomError(
          "Not all orders has been marked as ran out of funds",
          400
        );
      logger.info(hasAllOrdersBeenMarkedAsOutOfFunds);

      const collectionProgress = await collectionProgressRepository.getById(
        order.collectionId
      );
      if (!collectionProgress)
        throw new CustomError("Collection progress not found", 400);
      if (collectionProgress.ranOutOfFunds || collectionProgress.retopAmount)
        return res.status(200).json({ success: true });

      // TODO: Estimate top up amount from traitValue & recursive/1-of-1 collectible count and fileSize
      /* 
        - validate state and authorizations
        - get undone trait values
            - count, average file size
        - get undone recursive collectibles
            - count, average trait count
        - get undone 1-of-1 edition collectibles
            - count, average file size
      */
      const estimatedTopupAmount = 25000;

      const { paymentInitialized, launchConfirmed, ...rest } =
        collectionProgress;

      await collectionProgressServices.update(collectionProgress.collectionId, {
        ranOutOfFunds: true,
        retopAmount: estimatedTopupAmount
      });

      return res
        .status(200)
        .json({ success: true, data: "Succesfully marked" });
    } catch (e) {
      next(e);
    }
  },
  initiateUploadSessions: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const { id } = req.params;
    const {
      expectedTraitTypes,
      expectedTraitValues,
      expectedRecursive,
      expectedOOOEditions
    } = req.body;

    try {
      if (!expectedTraitTypes || !expectedTraitValues || !expectedRecursive)
        throw new CustomError("Invalid data", 400);
      if (
        !Number.isInteger(expectedTraitTypes) ||
        !Number.isInteger(expectedTraitValues) ||
        !Number.isInteger(expectedRecursive) ||
        (expectedOOOEditions && !Number.isInteger(expectedOOOEditions))
      )
        throw new CustomError("Invalid data", 400);

      const collectionProgress = await collectionProgressRepository.getById(id);
      if (!collectionProgress)
        throw new CustomError("Collection progress not found", 400);
      if (!collectionProgress.paymentCompleted)
        throw new CustomError("Please complete the funding process first", 400);

      const collectionUploadSession =
        await collectionUploadSessionRepository.create({
          collectionId: id,
          expectedTraitTypes,
          expectedTraitValues,
          expectedRecursive,
          expectedOOOEditions
        });

      return res
        .status(200)
        .json({ success: true, data: collectionUploadSession });
    } catch (e) {
      next(e);
    }
  },
  getUploadSessionByCollectionId: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const { id } = req.params;

    try {
      const collectionUploadSession =
        await collectionUploadSessionRepository.getById(id);
      if (!collectionUploadSession)
        throw new CustomError("Collection Upload Session not found", 400);

      return res
        .status(200)
        .json({ success: true, data: collectionUploadSession });
    } catch (e) {
      next(e);
    }
  }
};

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
