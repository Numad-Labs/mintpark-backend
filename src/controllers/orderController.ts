import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../custom";
import { orderServices } from "../services/orderServices";
import { CustomError } from "../exceptions/CustomError";
import { hideSensitiveData } from "../libs/hideDataHelper";

export const orderController = {
  // createCollectible: async (
  //   req: AuthenticatedRequest,
  //   res: Response,
  //   next: NextFunction
  // ) => {
  //   try {
  //     if (!req.user) throw new CustomError("Cannot parse user from token", 401);
  //     const { collectionId, feeRate, txid, userLayerId } = req.body;
  //     if (!feeRate)
  //       throw new CustomError("Order type and fee rate are required.", 400);
  //     if (!userLayerId)
  //       throw new CustomError("Please provide an userLayerId.", 400);
  //     if (!collectionId)
  //       throw new CustomError(
  //         "CollectionId is required when creating order for collection or launch.",
  //         400
  //       );
  //     const file = req.file as Express.Multer.File;
  //     const { order, orderItem, batchMintTxHex } =
  //       await orderServices.createCollectible(
  //         req.user.id,
  //         userLayerId,
  //         Number(feeRate),
  //         [file],
  //         collectionId,
  //         txid
  //       );
  //     const sanitazedOrder = hideSensitiveData(order, ["privateKey"]);
  //     return res.status(200).json({
  //       success: true,
  //       data: { order: sanitazedOrder, orderItems: orderItem, batchMintTxHex },
  //     });
  //   } catch (e) {
  //     next(e);
  //   }
  // },
  createMintOrder: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const {
        collectionId,
        feeRate,
        txid,
        userLayerId,
        totalFileSize,
        totalTraitCount,
        totalCollectibleCount,
      } = req.body;

      if (!req.user?.id)
        throw new CustomError("Cannot parse user from token", 401);
      if (!feeRate)
        throw new CustomError("Order type and fee rate are required.", 400);
      if (!collectionId)
        throw new CustomError(
          "CollectionId is required when creating mint order.",
          400
        );
      if (!userLayerId)
        throw new CustomError(
          "userLayerId is required when creating order for collection.",
          400
        );

      const { order } = await orderServices.createMintOrder(
        req.user.id,
        userLayerId,
        totalFileSize,
        totalTraitCount,
        totalCollectibleCount,
        Number(feeRate),
        collectionId,
        txid
      );
      const sanitazedOrder = hideSensitiveData(order, ["privateKey"]);

      return res.status(200).json({
        success: true,
        data: { order: sanitazedOrder },
      });
    } catch (e) {
      next(e);
    }
  },
  invokeOrderForMinting: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Cannot parse user from token", 401);
      const { id } = req.params;

      const { order } = await orderServices.invokeOrderForMinting(
        req.user.id,
        id
      );

      const sanitizedOrder = hideSensitiveData(order, ["privateKey"]);

      return res
        .status(200)
        .json({ success: true, data: { order: sanitizedOrder } });
    } catch (e) {
      next(e);
    }
  },
  // generateMintTxHex: async (
  //   req: AuthenticatedRequest,
  //   res: Response,
  //   next: NextFunction
  // ) => {
  //   try {
  //     const { orderId, layerId } = req.body;
  //     if (!req.user) throw new CustomError("Cannot parse user from token", 400);
  //     if (!orderId) throw new CustomError("Cannot parse orderId", 400);
  //     if (!layerId) throw new CustomError("Cannot parse orderId", 400);
  //     const { order, batchMintTxHex } = await orderServices.generateMintTxHex(
  //       orderId,
  //       layerId,
  //       req.user.id
  //     );
  //     const sanitazedOrder = hideSensitiveData(order, ["privateKey"]);
  //     res.status(200).json({
  //       success: true,
  //       data: { order: sanitazedOrder, batchMintTxHex },
  //     });
  //   } catch (e) {
  //     next(e);
  //   }
  // },
  getByUserId: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      if (req.user?.id !== userId)
        throw new CustomError("You are not allowed to access this info", 400);
      const orders = await orderServices.getByUserId(userId);
      const sanitizedOrders = orders.map((order) => {
        return hideSensitiveData(order, ["privateKey"]);
      });
      return res.status(200).json({ success: true, data: sanitizedOrders });
    } catch (e) {
      next(e);
    }
  },
  getById: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { orderId } = req.params;
      const order = await orderServices.getById(orderId);
      if (req.user?.id !== order?.userId)
        throw new CustomError("You are not allowed to access this info", 400);
      if (!order) throw new CustomError("Order not found", 404);
      const sanitazedOrder = hideSensitiveData(order, ["privateKey"]);
      return res.status(200).json({ success: true, data: sanitazedOrder });
    } catch (e) {
      next(e);
    }
  },
  // //TODO: Adjust
  // checkOrderIsPaid: async (
  //   req: AuthenticatedRequest,
  //   res: Response,
  //   next: NextFunction
  // ) => {
  //   try {
  //     const { orderId } = req.params;
  //     const { txid, layerId } = req.query;
  //     if (!req.user?.id)
  //       throw new CustomError("Could not parse id from the token.", 401);
  //     if (!layerId) throw new CustomError("Please provide a layerId.", 400);
  //     const order = await orderServices.getById(orderId);
  //     if (!order) throw new CustomError("Order not found", 404);
  //     if (req.user?.id !== order.userId)
  //       throw new CustomError("You are not allowed to access this info", 400);
  //     if (order.orderStatus !== "PENDING")
  //       return res.status(200).json({ success: true, data: { isPaid: true } });
  //     const isPaid = await orderServices.checkOrderisPaid(
  //       order.id,
  //       layerId.toString(),
  //       txid?.toString()
  //     );
  //     return res.status(200).json({
  //       success: true,
  //       data: {
  //         isPaid: isPaid,
  //       },
  //     });
  //   } catch (e) {
  //     next(e);
  //   }
  // },
};
