import { NextFunction, Request, Response } from "express";
import { CustomError } from "../exceptions/CustomError";
import { LaunchQueryParams } from "../repositories/collectionRepository";
import { AuthenticatedRequest } from "../../custom";
import { launchServices } from "../services/launchServices";
// import LaunchpadService from "../../blockchain/evm/services/launchpadService";
import { EVM_CONFIG } from "../../blockchain/evm/evm-config";
import MarketplaceService from "../../blockchain/evm/services/marketplaceService";
import { serializeBigInt } from "../../blockchain/evm/utils";
import { Insertable, Updateable } from "kysely";
import { Launch } from "../types/db/types";
import { launchRepository } from "../repositories/launchRepository";
import {
  ipfsNftParams,
  recursiveInscriptionParams,
} from "./collectibleController";
import { userRepository } from "../repositories/userRepository";
import LaunchpadService from "../../blockchain/evm/services/launchpadService";
import logger from "../config/winston";

export interface LaunchOfferType {
  offerType: "public" | "whitelist";
}

const launchPadService = new LaunchpadService(
  EVM_CONFIG.RPC_URL,
  new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS)
);

export const launchController = {
  create: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Cannot parse user from token", 401);

      const data: Insertable<Launch> = { ...req.body.data };
      const { txid, totalFileSize, feeRate } = req.body;

      if (!txid || !data.userLayerId)
        throw new CustomError("Invalid input.", 400);

      const { launch, order } = await launchServices.create(
        req.user.id,
        data,
        txid,
        totalFileSize,
        feeRate
      );

      return res.status(200).json({ success: true, data: { launch, order } });
    } catch (e) {
      next(e);
    }
  },
  createInscriptionAndLaunchItemsInBatch: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Could not parse the id from the token.", 400);

      const { collectionId, isLastBatch } = req.body;
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

      const result = await launchServices.createInscriptionAndLaunchItemInBatch(
        req.user.id,
        collectionId,
        names,
        files,
        isLastBatch === "true"
      );

      return res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  },
  createRecursiveInscriptionAndLaunchItemsInBatch: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Could not parse the id from the token.", 400);

      const { collectionId, isLastBatch } = req.body;
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
        await launchServices.createRecursiveInscriptionAndLaunchItemInBatch(
          req.user.id,
          collectionId,
          data,
          isLastBatch
        );

      return res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  },
  createIpfsNftAndLaunchItemsInBatch: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Could not parse the id from the token.", 400);

      const { collectionId, isLastBatch } = req.body;
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

      const result = await launchServices.createIpfsNftAndLaunchItemInBatch(
        req.user.id,
        collectionId,
        data,
        isLastBatch
      );

      return res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  },
  buy: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Could not parse the id from the token.", 400);

      const { id } = req.params;
      const { userLayerId, feeRate } = req.body;

      const result = await launchServices.buy(
        req.user.id,
        userLayerId,
        id,
        feeRate
      );

      return res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  },
  mint: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Could not parse the id from the token.", 400);

      const { userLayerId, launchItemId, txid, orderId } = req.body;

      const result = await launchServices.confirmMint(
        req.user.id,
        userLayerId,
        launchItemId,
        { txid, orderId }
      );

      return res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  },
  getAllLaunchesByLayerId: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { layerId, interval } = req.query;
      if (!layerId || !interval)
        throw new CustomError(
          "Please provide a layerId, interval as query.",
          400
        );
      const query: LaunchQueryParams = {
        layerId: layerId as string,
        interval: interval as "all" | "live" | "past",
      };

      const launches = await launchRepository.getConfirmedLaunchesByLayerId(
        query
      );

      return res.status(200).json({ success: true, data: launches });
    } catch (e) {
      next(e);
    }
  },
  getLaunchByCollectionId: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectionId } = req.params;

      try {
        const launch = await launchRepository.getConfirmedLaunchById(
          collectionId
        );
        if (!launch) throw new CustomError("Collection not found", 404);

        return res.status(200).json({ success: true, data: launch });
      } catch (e) {
        next(e);
      }
    } catch (e) {
      next(e);
    }
  },
  generateUnsignedMintPriceChangeTx: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectionTxid, mintFee } = req.body.data;
      const { userLayerId } = req.body;
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);
      const user = await userRepository.getByUserLayerId(userLayerId);
      if (!user || !user.address || user.id !== userLayerId)
        throw new CustomError("User address not found from the token.", 400);
      if (!user.isActive)
        throw new CustomError("This account is deactivated.", 400);

      const unsignedTx =
        await launchPadService.createLaunchpadContractFeeChange(
          collectionTxid,
          user.address,
          mintFee
        );
      const serializedTx = serializeBigInt(unsignedTx);
      return res.status(200).json({
        success: true,
        data: { singleMintTxHex: serializedTx },
      });
    } catch (e) {
      next(e);
    }
  },
  createOrderForReservedLaunchItems: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Could not parse the id from the token.", 400);

      const { launchId, userLayerId } = req.body;

      const result = await launchServices.createOrderForReservedLaunchItems(
        launchId,
        req.user.id,
        userLayerId
      );

      return res.status(200).json({ result });
    } catch (e) {
      next(e);
    }
  },
  invokeMintingForReservedLaunchItems: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Could not parse the id from the token.", 400);

      const { orderId, launchId, userLayerId } = req.body;

      const result = await launchServices.invokeMintingForReservedLaunchItems(
        orderId,
        launchId,
        req.user.id,
        userLayerId
      );

      return res.status(200).json({ result });
    } catch (e) {
      next(e);
    }
  },
};
