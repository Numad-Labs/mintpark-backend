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
        inscribedAmount,
        req.user.id
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
      let { feeRate } = req.body;
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);
      if (feeRate < 1) throw new CustomError("Invalid fee rate.", 400);
      if (!feeRate) feeRate = 1;

      const txHex = await listServices.generateBuyPsbtHex(
        id,
        feeRate,
        req.user.id
      );

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

      const { confirmedList, txid } = await listServices.buyListedCollectible(
        id,
        hex,
        req.user.id
      );

      return res
        .status(200)
        .json({ success: true, data: { confirmedList, txid } });
    } catch (e) {
      next(e);
    }
  },
  getEstimatedFee: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      let { feeRate } = req.body;
      if (feeRate < 1) throw new CustomError("Invalid fee rate.", 400);
      if (!feeRate) feeRate = 1;

      const estimation = await listServices.estimateFee(id, feeRate);

      return res.status(200).json({
        success: true,
        data: {
          estimation,
        },
      });
    } catch (e) {
      next(e);
    }
  },
};
