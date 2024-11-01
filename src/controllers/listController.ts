import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../../custom";
import { CustomError } from "../exceptions/CustomError";
import { MAX_SATOSHI_AMOUNT } from "../../blockchain/utxo/constants";
import { listServices } from "../services/listServices";
import TradingService from "../../blockchain/evm/services/tradingService";
import { EVM_CONFIG } from "../../blockchain/evm/evm-config";
import MarketplaceService from "../../blockchain/evm/services/marketplaceService";
import { userRepository } from "../repositories/userRepository";
import { serializeBigInt } from "../../blockchain/evm/utils";
import { collectionRepository } from "../repositories/collectionRepository";
import { db } from "../utils/db";
const tradingService = new TradingService(
  EVM_CONFIG.RPC_URL,
  EVM_CONFIG.MARKETPLACE_ADDRESS,
  new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS)
);

const marketplaceService = new MarketplaceService(
  EVM_CONFIG.MARKETPLACE_ADDRESS
);

export const listController = {
  createMarketplaceContractDeployment: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { initialOwner } = req.body;
      const unsignedTx =
        await marketplaceService.getUnsignedDeploymentTransaction(initialOwner);

      // Serialize BigInt values before sending the response
      const serializedTx = serializeBigInt(unsignedTx);
      res.json({ success: true, unsignedTransaction: serializedTx });
    } catch (e) {
      next(e);
    }
  },
  getApprovelTransactionOfTrading: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectionId } = req.body;
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);
      const user = await userRepository.getById(req.user.id);
      if (!user) throw new CustomError("User not found", 400);
      if (!collectionId)
        throw new CustomError("Please provide a collectionId.", 400);

      const collection = await collectionRepository.getById(db, collectionId);
      if (!collection || !collection.contractAddress)
        throw new CustomError("Please provide a valid collection.", 400);

      const unsignedTx = await tradingService.getUnsignedApprovalTransaction(
        collection.contractAddress,
        user?.address
      );
      const serializedTx = serializeBigInt(unsignedTx);

      return res
        .status(200)
        .json({ success: true, data: { approveTxHex: serializedTx } });
    } catch (e) {
      next(e);
    }
  },
  listCollectible: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectibleId, price, txid } = req.body;
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);
      if (!collectibleId)
        throw new CustomError("Please provide a collectibleId.", 400);
      if (!collectibleId || (price > MAX_SATOSHI_AMOUNT && price <= 0))
        throw new CustomError("Invalid price amount.", 400);

      const list = await listServices.listCollectible(
        price,
        collectibleId,
        req.user.id,
        txid
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

      return res.status(200).json({ success: true, data: { txHex } });
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
      const { hex, txid } = req.body;
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);

      const result = await listServices.buyListedCollectible(
        id,
        hex,
        req.user.id,
        txid
      );

      return res.status(200).json({
        success: true,
        data: { confirmedList: result.confirmedList, txid: result.txid },
      });
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
