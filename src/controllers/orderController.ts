import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../custom";
import { orderServices } from "../services/orderServices";
import { CustomError } from "../exceptions/CustomError";

export const orderController = {
  create: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) throw new CustomError("Cannot parse user from token", 401);
    const { orderType } = req.body;
    const files = req.files as Express.Multer.File[];

    try {
      const order = await orderServices.create(req.user.id, orderType, files);

      return res.status(200).json({ success: true, data: order });
    } catch (e) {
      next(e);
    }
  },
};
