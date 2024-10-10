import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest, tokenData } from "../../custom";
import { Insertable } from "kysely";
import { Collectible } from "../types/db/types";
import { collectibleServices } from "../services/collectibleServices";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { CustomError } from "../exceptions/CustomError";
import { orderRepository } from "../repositories/orderRepository";

export const collectibleController = {
  createOrder: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user)
        throw new CustomError("Could not retrieve id from the token", 400);

      const file = req.file as Express.Multer.File;
      if (!file) throw new CustomError("Please provide the file", 400);
      const { name, creator, description, mintLayerType, feeRate } = req.body;
      if (!name || !mintLayerType || !feeRate)
        throw new CustomError(
          "Please provide all required fields. (name, mintLayerType, feeRate).",
          400
        );
      const order = await collectibleServices.createOrderToMintCollectible(
        file,
        req.user.address,
        mintLayerType,
        feeRate
      );

      return res.status(200).json({
        success: true,
        data: {
          orderId: order.orderId,
          fundingAddress: order.fundingAddress,
          serviceFee: order.serviceFee,
          networkFee: order.networkFee,
          requiredAmountToFund: order.amount,
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
      if (!req.user)
        throw new CustomError("Could not retrieve id from the token", 400);

      const { orderId } = req.body;
      const order = await orderRepository.getById(orderId);
      if (!order) throw new CustomError("Order not found", 404);
      if (order.userAddress !== req.user.address)
        throw new CustomError("You are not allowed to do this action.", 403);

      const mintResult = await collectibleServices.generateHexForCollectible(
        orderId,
        req.user.address
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
