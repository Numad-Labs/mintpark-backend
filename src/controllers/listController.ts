import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../../custom";
import { CustomError } from "../exceptions/CustomError";
import { listServices } from "../services/listServices";
import TradingService from "../blockchain/evm/services/tradingService";
import { EVM_CONFIG } from "../blockchain/evm/evm-config";
import MarketplaceService from "../blockchain/evm/services/marketplaceService";
import { userRepository } from "../repositories/userRepository";
import { serializeBigInt } from "../blockchain/evm/utils";
import { collectionRepository } from "../repositories/collectionRepository";
import { db } from "../utils/db";
import { MAX_SATOSHI_AMOUNT } from "../blockchain/bitcoin/constants";
const tradingService = new TradingService(
  EVM_CONFIG.RPC_URL,
  EVM_CONFIG.MARKETPLACE_ADDRESS,
  new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS),
);

const marketplaceService = new MarketplaceService(
  EVM_CONFIG.MARKETPLACE_ADDRESS,
);

export const listController = {
  createMarketplaceContractDeployment: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { initialOwner, marketplaceFee } = req.body;
      const unsignedTx =
        await marketplaceService.getUnsignedDeploymentTransaction(
          initialOwner,
          marketplaceFee,
        );

      // Serialize BigInt values before sending the response
      const serializedTx = serializeBigInt(unsignedTx);
      res.json({ success: true, unsignedTransaction: serializedTx });
    } catch (e) {
      next(e);
    }
  },
  generateApprovelTransactionOfTrading: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { collectionId, userLayerId } = req.body;
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);
      if (!userLayerId)
        throw new CustomError("Please provide a userLayerId.", 400);

      const user = await userRepository.getByUserLayerId(userLayerId);
      if (!user) throw new CustomError("User not found", 400);
      if (user.id !== req.user.id)
        throw new CustomError("You are not allowed to do this action.", 400);
      if (!user.isActive)
        throw new CustomError("This account is deactivated.", 400);

      if (!collectionId)
        throw new CustomError("Please provide a collectionId.", 400);
      const collection = await collectionRepository.getById(db, collectionId);
      if (!collection || !collection.contractAddress)
        throw new CustomError("Please provide a valid collection.", 400);

      const unsignedTx = await tradingService.getUnsignedApprovalTransaction(
        collection.contractAddress,
        user?.address,
      );
      const serializedTx = serializeBigInt(unsignedTx);
      return res
        .status(200)
        .json({ success: true, data: { approveTxHex: serializedTx } });
    } catch (e) {
      next(e);
    }
  },
  checkRegistration: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { collectionId, userLayerId, tokenId } = req.body;
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);
      if (!userLayerId) throw new CustomError("Invalid userLayerId.", 400);
      const issuerId = req.user.id; // Assuming you have auth middleware

      const result = await listServices.checkAndPrepareRegistration(
        collectionId,
        issuerId,
        userLayerId,
        tokenId,
      );

      res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  },
  listCollectible: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
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
        txid,
      );
      return res.status(200).json({ success: true, data: { list } });
    } catch (e) {
      next(e);
    }
  },
  confirmPendingList: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
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
        req.user.id,
      );
      return res.status(200).json({ success: true, data: { list } });
    } catch (e) {
      next(e);
    }
  },
  generateTxHexToBuyListedCollectible: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;
      let { feeRate, userLayerId } = req.body;
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);
      if (!userLayerId) throw new CustomError("Invalid layerId.", 400);
      if (feeRate < 1) throw new CustomError("Invalid fee rate.", 400);
      if (!feeRate) feeRate = 1;
      const txHex = await listServices.generateBuyTxHex(
        id,
        userLayerId,
        feeRate,
        req.user.id,
      );
      return res.status(200).json({ success: true, data: { txHex } });
    } catch (e) {
      next(e);
    }
  },
  buyListedCollectible: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;
      const { hex, txid, userLayerId } = req.body;
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);
      const result = await listServices.buyListedCollectible(
        id,
        userLayerId,
        hex,
        req.user.id,
        txid,
      );
      return res.status(200).json({
        success: true,
        data: { confirmedList: result.confirmedList, txid: result.txid },
      });
    } catch (e) {
      next(e);
    }
  },
  generateCancelListingTx: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;

      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);
      const result = await listServices.generateListingCancelTx(
        req.user.id,
        id,
      );

      return res.status(200).json({
        success: true,
        data: { result },
      });
    } catch (e) {
      next(e);
    }
  },
  confirmCancelListingTx: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;

      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);
      const result = await listServices.confirmListingCancel(req.user.id, id);

      return res.status(200).json({
        success: true,
        data: { result },
      });
    } catch (e) {
      next(e);
    }
  },
  // getEstimatedFee: async (
  //   req: AuthenticatedRequest,
  //   res: Response,
  //   next: NextFunction
  // ) => {
  //   try {
  //     const { id } = req.params;
  //     let { feeRate } = req.body;
  //     if (feeRate < 1) throw new CustomError("Invalid fee rate.", 400);
  //     if (!feeRate) feeRate = 1;
  //     const estimation = await listServices.estimateFee(id, feeRate);
  //     return res.status(200).json({
  //       success: true,
  //       data: {
  //         estimation,
  //       },
  //     });
  //   } catch (e) {
  //     next(e);
  //   }
  // },
};
