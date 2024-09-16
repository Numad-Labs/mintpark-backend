import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../../custom";
import { purchaseServices } from "../services/purchaseServices";
import { Insertable } from "kysely";
import { Purchase } from "../types/db/types";
import { CustomError } from "../exceptions/CustomError";

export const purchaseController = {
  generateTransaction: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { collectionId } = req.params;

    try {
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);

      const result = await purchaseServices.generateTransaction(
        collectionId,
        req.user.id
      );

      console.log({ success: true, data: result });
      return res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  },
  create: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const data: Insertable<Purchase> = { ...req.body };

    try {
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);

      if (req.user.id !== data.buyerId)
        throw new CustomError(
          "Different user from the authenticated one.",
          400
        );

      const result = await purchaseServices.verify(data, req.user.id);

      return res.status(200).json({ success: true, data: { txid: result } });
    } catch (e) {
      next(e);
    }
  },
};
