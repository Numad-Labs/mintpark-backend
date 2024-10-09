import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../../custom";
import { CustomError } from "../exceptions/CustomError";
import { orderRepository } from "../repositories/orderRepository";
import { LAYER_TYPE } from "../types/db/enums";
import { orderServices } from "../services/orderServices";

export const orderController = {
  getUserOrdersByLayerType: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user)
        throw new CustomError("Could not retrieve id from the token", 400);
      const address = req.user.address;
      const layerType = req.params.layerType as string;
      const orders = await orderRepository.getUserOrdersByLayerType(
        address,
        layerType.toUpperCase() as LAYER_TYPE
      );
      return res.status(200).json({ success: true, orders: orders });
    } catch (e) {
      next(e);
    }
  },
  getByOrderId: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orderId = req.params.orderId;
      const order = await orderRepository.getById(orderId);
      return res.status(200).json({ success: true, order: order });
    } catch (e) {
      next(e);
    }
  },
  getFeeRates: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const layerType = req.params.layerType as string;
      const feeRates = await orderServices.getFeeRates(
        layerType.toUpperCase() as LAYER_TYPE
      );
      return res.status(200).json({ success: true, feeRates: feeRates });
    } catch (e) {
      next(e);
    }
  },
  getAllFeeRates: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const feeRates = await orderServices.getAllFeeRates();
      return res.status(200).json({ success: true, feeRates: feeRates });
    } catch (e) {
      next(e);
    }
  },
};
