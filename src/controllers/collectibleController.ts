import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../../custom";
import { CustomError } from "../exceptions/CustomError";
import { collectibleServices } from "../services/collectibleServices";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { EVMCollectibleService } from "../../blockchain/evm/services/evmIndexService";
import { EVM_CONFIG } from "../../blockchain/evm/evm-config";
import { createFundingAddress } from "../blockchain/bitcoin/createFundingAddress";
import { sendRawTransaction } from "../blockchain/bitcoin/sendTransaction";
import { inscribe } from "../blockchain/bitcoin/inscribe";
import logger from "../config/winston";

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
  layerId: string;
  userLayerId?: string;
}

export interface recursiveInscriptionParams {
  name: string;
  traits: { type: string; value: string }[];
}

export interface ipfsNftParams {
  name: string;
  cid: string;
}

export const collectibleControllers = {
  getListableCollectibles: async (
    req: Request<{ userId: string }, {}, {}, CollectibleQueryParams>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const {
        isListed = false,
        orderBy,
        orderDirection,
        layerId,
        userLayerId,
      } = req.query;
      const collectionIds = req.query.collectionIds as string[];
      const { userId } = req.params;
      if (!userId) throw new CustomError("userId not found.", 400);
      const result = await collectibleServices.getListableCollectibles(userId, {
        isListed,
        orderBy,
        orderDirection,
        collectionIds,
        layerId,
        userLayerId,
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
      const { orderBy, orderDirection, isListed = false, layerId } = req.query;
      const traits: string[] = req.query.traits as string[];
      const result =
        await collectibleServices.getListableCollectiblesByCollectionId(
          collectionId,
          {
            orderBy,
            orderDirection,
            isListed,
            traits,
            layerId,
          }
        );
      return res.status(200).json({
        success: true,
        data: {
          collectibles: result.listableCollectibles,
          listedCollectibleCount: result.activeListCount,
          // totalOwnerCount: result.totalOwnerCount,
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
      const collectible = await collectibleRepository.getByIdWithDetails(id);
      return res.status(200).json({ success: true, data: collectible });
    } catch (e) {
      next(e);
    }
  },
  getTokenActivity: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { collectibleId } = req.params;
      const { fromBlock } = req.query;
      if (!collectibleId) {
        throw new CustomError("collectibleId is required", 400);
      }
      const activities = await collectibleServices.getActivityByCollectibleId(
        collectibleId
      );
      res.status(200).json({
        success: true,
        data: activities,
      });
    } catch (error) {
      next(error);
    }
  },
  // update: async (
  //   req: AuthenticatedRequest,
  //   res: Response,
  //   next: NextFunction
  // ) => {},
  createInscriptionInBatch: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Could not parse the id from the token.", 400);

      const { collectionId } = req.body;
      const parsedJsonData = JSON.parse(req.body.names);
      const names: string[] = Array.isArray(parsedJsonData)
        ? parsedJsonData
        : parsedJsonData
        ? [parsedJsonData]
        : [];
      const files: Express.Multer.File[] = req.files as Express.Multer.File[];

      if (names.length === 0)
        throw new CustomError("Please provide the names.", 400);
      if (files.length === 0)
        throw new CustomError("Please provide the files.", 400);
      if (files.length > 10)
        throw new CustomError("You cannot provide more than 10 files.", 400);
      if (files.length !== names.length)
        throw new CustomError("Differing number of names & files found.", 400);

      const result =
        await collectibleServices.createInscriptionAndOrderItemInBatch(
          req.user.id,
          collectionId,
          names,
          files
        );

      return res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  },
  createRecursiveInscriptionInBatch: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Could not parse the id from the token.", 400);

      const { collectionId } = req.body;
      console.log(req.body.data);
      const data: recursiveInscriptionParams[] = Array.isArray(req.body.data)
        ? req.body.data
        : req.body.data
        ? [req.body.data]
        : [];
      if (data.length === 0)
        throw new CustomError("Please provide the data.", 400);
      if (data.length > 10)
        throw new CustomError(
          "You cannot provide more than 10 elements of data.",
          400
        );

      const result =
        await collectibleServices.createRecursiveInscriptionAndOrderItemInBatch(
          req.user.id,
          collectionId,
          data
        );

      return res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  },
  createIpfsNftInBatch: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Could not parse the id from the token.", 400);

      const { collectionId } = req.body;
      const data: ipfsNftParams[] = Array.isArray(req.body.data)
        ? req.body.data
        : req.body.data
        ? [req.body.data]
        : [];
      if (data.length === 0)
        throw new CustomError("Please provide the data.", 400);
      if (data.length > 10)
        throw new CustomError(
          "You cannot provide more than 10 elements of data.",
          400
        );

      const result = await collectibleServices.createIpfsNftAndOrderItemInBatch(
        req.user.id,
        collectionId,
        data
      );

      return res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  },
  // inscribe: async (
  //   req: AuthenticatedRequest,
  //   res: Response,
  //   next: NextFunction
  // ) => {
  //   try {
  //     const file = req.file;
  //     if (!file) throw new CustomError("File not found.", 400);

  //     const fundingAddress =
  //       "tb1p2l6ck4u9dx8jl9gy07gvz5w2e792tqteekspvrsjx5ma6nq88fzse6axxr";
  //     const fundingPrivateKey =
  //       "";

  //     const vault = await createFundingAddress("TESTNET");
  //     const inscriptionData = {
  //       address: vault.address,
  //       opReturnValues: `data:${file?.mimetype};base64,${(
  //         file?.buffer as Buffer
  //       ).toString("base64")}` as any,
  //     };
  //     const { commitTxHex, revealTxHex } = await inscribe(
  //       inscriptionData,
  //       fundingAddress,
  //       fundingPrivateKey,
  //       true,
  //       1
  //     );
  //     const commitTxResult = await sendRawTransaction(commitTxHex);
  //     if (!commitTxResult)
  //       throw new CustomError("Could not broadcast the commit tx.", 400);
  //     const revealTxResult = await sendRawTransaction(revealTxHex);
  //     if (!revealTxResult)
  //       throw new CustomError("Could not broadcast the reveal tx.", 400);
  //     logger.info(
  //       `Inscribed in transaction: ${commitTxResult} + ${revealTxResult}`
  //     );

  //     return res.status(200).json({ vault, commitTxResult, revealTxResult });
  //   } catch (e) {
  //     next(e);
  //   }
  // },
};
