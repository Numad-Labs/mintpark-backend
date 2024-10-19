import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../../custom";
import { CustomError } from "../exceptions/CustomError";
import { MAX_SATOSHI_AMOUNT } from "../../blockchain/utxo/constants";
import { listServices } from "../services/listServices";

export const listController = {
  listCollectible: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectibleId, price } = req.body;
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);
      if (!collectibleId)
        throw new CustomError("Please provide a collectibleId.", 400);
      if (!collectibleId || (price > MAX_SATOSHI_AMOUNT && price <= 0))
        throw new CustomError("Invalid price amount.", 400);

      const list = await listServices.listCollectible(
        price,
        collectibleId,
        req.user.id
      );

      return res.status(200).json({ success: true, data: { list } });
    } catch (e) {
      next(e);
    }
  },
  confirmPendingList: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const { txid, vout, inscribedAmount } = req.body;
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);

      const list = await listServices.confirmPendingList(
        id,
        txid,
        vout,
        inscribedAmount
      );

      return res.status(200).json({ success: true, data: { list } });
    } catch (e) {
      next(e);
    }
  },
  generatePsbtHexToBuyListedCollectible: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);

      const txHex = await listServices.generateBuyPsbtHex(id, req.user.id);

      return res.status(200).json({ success: true, data: { hex: txHex } });
    } catch (e) {
      next(e);
    }
  },
  buyListedCollectible: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const { hex } = req.body;
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);
      if (!hex) throw new CustomError("Please provide the hex", 400);

      const txid = await listServices.buyListedCollectible(
        id,
        hex,
        req.user.id
      );

      return res.status(200).json({ success: true, data: { txid } });
    } catch (e) {
      next(e);
    }
  },
};
