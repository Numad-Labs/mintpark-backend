import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../custom";
import { orderServices } from "../services/orderServices";
import { CustomError } from "../exceptions/CustomError";
import { hideSensitiveData } from "../libs/hideDataHelper";

export const orderController = {
  create: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) throw new CustomError("Cannot parse user from token", 401);
    const { orderType, collectionId, feeRate } = req.body;
    if (!orderType || !feeRate)
      throw new CustomError("Order type and fee rate are required.", 400);
    const files = req.files as Express.Multer.File[];
    if (!files || files.length < 1)
      throw new CustomError("Please provide at least one file.", 400);

    try {
      if (orderType === "COLLECTION" && !collectionId)
        throw new CustomError(
          "CollectionId is required when creating order for collection.",
          400
        );
      const { order, orderItems } = await orderServices.create(
        req.user.id,
        orderType,
        Number(feeRate),
        files,
        collectionId
      );
      const sanitazedOrder = hideSensitiveData(order, ["privateKey"]);

      return res.status(200).json({
        success: true,
        data: { order: sanitazedOrder, orderItems: orderItems },
      });
    } catch (e) {
      next(e);
    }
  },
  getByUserId: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const orders = await orderServices.getByUserId(userId);
      const sanitazedOrders = orders.map((order) => {
        return hideSensitiveData(order, ["privateKey"]);
      });

      return res.status(200).json({ success: true, data: sanitazedOrders });
    } catch (e) {
      next(e);
    }
  },
  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const order = await orderServices.getById(orderId);
      if (!order) throw new CustomError("Order not found", 404);
      const sanitazedOrder = hideSensitiveData(order, ["privateKey"]);

      return res.status(200).json({ success: true, data: sanitazedOrder });
    } catch (e) {
      next(e);
    }
  },
  checkOrderIsPaid: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const order = await orderServices.getById(orderId);
      if (!order) throw new CustomError("Order not found", 404);
      const isPaid = await orderServices.checkOrderisPaid(order.id);
      return res.status(200).json({
        success: true,
        data: {
          isPaid: isPaid,
        },
      });
    } catch (e) {
      next(e);
    }
  },
};
