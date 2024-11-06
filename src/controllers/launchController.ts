import { NextFunction, Request, Response } from "express";
import { CustomError } from "../exceptions/CustomError";
import { LaunchQueryParams } from "../repositories/collectionRepository";
import { collectionServices } from "../services/collectionServices";
import { AuthenticatedRequest } from "../../custom";
import { launchServices } from "../services/launchServices";
import { layerServices } from "../services/layerServices";
import { userRepository } from "../repositories/userRepository";
import LaunchpadService from "../../blockchain/evm/services/launchpadService";
import { EVM_CONFIG } from "../../blockchain/evm/evm-config";
import MarketplaceService from "../../blockchain/evm/services/marketplaceService";
import { serializeBigInt } from "../../blockchain/evm/utils";
import { Updateable } from "kysely";
import { Launch } from "../types/db/types";
import { launchRepository } from "../repositories/launchRepository";

export interface LaunchOfferType {
  offerType: "public" | "whitelist";
}

const launchPadService = new LaunchpadService(
  EVM_CONFIG.RPC_URL,
  new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS)
);

export const launchController = {
  getAllLaunchedCollectionsByLayerId: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const { layerId, interval } = req.query;
    try {
      if (!layerId || !interval)
        throw new CustomError(
          "Please provide a layerId, interval as query.",
          400
        );

      const query: LaunchQueryParams = {
        layerId: layerId as string,
        interval: interval as "all" | "live" | "past",
      };
      const collections =
        await collectionServices.getAllLaunchedCollectionsByLayerId(query);
      return res.status(200).json({ success: true, data: collections });
    } catch (e) {
      next(e);
    }
  },
  getLaunchedCollectionById: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const { collectionId } = req.params;
    try {
      const collection = await collectionServices.getLaunchedCollectionById(
        collectionId
      );
      if (!collection) throw new CustomError("Collection not found", 404);
      return res.status(200).json({ success: true, data: collection });
    } catch (e) {
      next(e);
    }
  },
  generateOrderForLaunchedCollection: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { collectionId } = req.params;
    const { feeRate, launchOfferType } = req.body;

    try {
      const user = await userRepository.getById(req.user?.id!);
      if (!user) throw new CustomError("User not found.", 404);
      if (!collectionId)
        throw new CustomError("CollectionId is required as param.", 400);
      if (!feeRate) throw new CustomError("Fee rate is required.", 400);

      const layer = await layerServices.getById(user.layerId!);
      if (!layer) throw new CustomError("Layer not found.", 404);

      if (layer.layer !== "FRACTAL" && layer.network !== "TESTNET")
        throw new CustomError("Not supported for this layer yet.", 400);

      const offerType: LaunchOfferType = {
        offerType: launchOfferType as "public" | "whitelist",
      };

      const order = await launchServices.generateOrderForLaunchedCollection(
        collectionId,
        user.id,
        feeRate,
        offerType
      );

      return res.status(200).json({ success: true, data: order });
    } catch (e) {
      next(e);
    }
  },
  getUnsignedMintPriceChange: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectionTxid, mintFee } = req.body.data;
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);
      const user = await userRepository.getById(req.user?.id!);
      if (!user || !user.address)
        throw new CustomError("User address not found from the token.", 400);

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
  invokeOrder: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { orderId, launchItemId, txid } = req.body;

    try {
      if (!req.user?.id) throw new CustomError("User not found.", 404);
      if (!orderId) throw new CustomError("OrderId is required as body.", 400);

      const mintHexes = await launchServices.mintPickedCollection(
        orderId,
        launchItemId,
        req.user?.id,
        txid
      );
      return res
        .status(200)
        .json({ success: true, data: { mintHexes: mintHexes } });
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
    const data: Updateable<Launch> = { ...req.body };

    try {
      if (!req.user?.id) throw new CustomError("User not found.", 404);

      const launch = await launchServices.update(id, data, req.user.id);

      return res.status(200).json({ success: true, data: { launch } });
    } catch (e) {
      next(e);
    }
  },
};
