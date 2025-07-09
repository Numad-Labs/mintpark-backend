import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../custom";
import { orderServices } from "../services/orderServices";
import { CustomError } from "../exceptions/CustomError";
import { hideSensitiveData } from "../libs/hideDataHelper";
import { orderRepository } from "@repositories/orderRepostory";
import { db } from "@utils/db";
import { getBalance } from "@blockchain/bitcoin/libs";

export const orderController = {
  createMintOrder: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectionId, estimatedFeeInSats, feeRate, txid, userLayerId } =
        req.body;

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

      const { order, walletQrString } = await orderServices.createMintOrder(
        estimatedFeeInSats,
        Number(feeRate),
        collectionId,
        req.user.id,
        userLayerId,
        txid
      );
      const sanitazedOrder = hideSensitiveData(order, ["privateKey"]);

      return res.status(200).json({
        success: true,
        data: { order: sanitazedOrder, walletQrString }
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
  checkOrderIsPaid: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Cannot parse user from token", 401);
      const { id } = req.params;

      const order = await orderRepository.getById(db, id);
      if (!order) throw new CustomError("Order not found", 400);
      if (!order.fundingAddress)
        throw new CustomError("Order does not have funding address", 400);
      const balance = await getBalance(order.fundingAddress);
      if (balance < order.fundingAmount)
        throw new CustomError("Please fund the order first", 400);

      return res.status(200).json({ success: true, data: { isPaid: true } });
    } catch (e) {
      next(e);
    }
  },
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
  getByIdWithDetailForService: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      const order = await orderRepository.getById(db, id);
      if (!order) throw new CustomError("Order not found", 404);

      return res.status(200).json({ success: true, data: order });
    } catch (e) {
      next(e);
    }
  }
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
