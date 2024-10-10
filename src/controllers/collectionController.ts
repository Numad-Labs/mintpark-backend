import { NextFunction, Request, Response } from "express";
import { Collection } from "../types/db/types";
import { Insertable } from "kysely";
import { collectionServices } from "../services/collectionServices";
import { AuthenticatedRequest } from "../../custom";
import { collectionRepository } from "../repositories/collectionRepository";
import { CustomError } from "../exceptions/CustomError";
import { LAYER_TYPE } from "@prisma/client";
import { create } from "domain";
import { orderServices } from "../services/orderServices";
import { orderRepository } from "../repositories/orderRepository";

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

      if (data.POStartDate || data.isLaunched || data.walletLimit || data.price)
        throw new CustomError(
          "Launching phase has not been started on this collection.",
          400
        );

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
  addToCollection: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userAddress = req.user?.address;
      if (!userAddress)
        throw new CustomError(
          "Could not retrieve address from the token.",
          400
        );
      const { collectionId } = req.params;
      const images = req.files as Express.Multer.File[];

      if (images.length === 0 || images.length > 10)
        throw new CustomError(
          "Please provide at least one and at most 10 images.",
          400
        );

      const collectibles = await collectionServices.addCollectiblesToCollection(
        images,
        collectionId,
        userAddress
      );

      return res.status(200).json({ success: true, data: collectibles });
    } catch (e) {
      next(e);
    }
  },
  createOrder: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userAddress = req.user?.address;
      const { feeRate } = req.body;
      if (!userAddress)
        throw new CustomError(
          "Could not retrieve address from the token.",
          400
        );
      const { collectionId } = req.params;
      const order = await collectionServices.createOrderToMintCollectible(
        collectionId,
        userAddress,
        Number(feeRate)
      );

      return res.status(200).json({
        success: true,
        data: {
          orderId: order.orderId,
          fundingAddress: order.fundingAddress,
          requiredAmountToFund: order.amount,
          serviceFee: order.serviceFee,
          networkFee: order.networkFee,
          feeRate: order.feeRate,
          mintLayerType: order.layerType,
          status: order.status,
          quantity: order.quantity,
        },
      });
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
      const address = req.user?.address;
      if (!address)
        throw new CustomError(
          "Could not retrieve address from the token.",
          400
        );
      const { collectionId } = req.params;
      const order = await orderRepository.getByCollectionId(collectionId);
      if (!order || !order.collectionId)
        throw new CustomError("No order created for this collection.", 400);
      const mintResult = await collectionServices.generateHexForCollection(
        order.orderId,
        address
      );

      return res.status(200).json({
        success: true,
        data: {
          ...mintResult,
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
    try {
      const address = req.user?.address;
      if (!address)
        throw new CustomError(
          "Could not retrieve address from the token.",
          400
        );
      const { POStartDate, walletLimit, price } = req.body;
      if (!POStartDate || !walletLimit || !price)
        throw new CustomError(
          "Please provide POStartDate, walletLimit and price.",
          400
        );
      const { collectionId } = req.params;
      const launchResult = await collectionServices.launchCollection(
        collectionId,
        address,
        POStartDate,
        Number(walletLimit),
        Number(price)
      );

      return res.status(200).json({ success: true, data: launchResult });
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
    if (!layerType)
      throw new CustomError("Please provide a layer type in query.", 400);

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
