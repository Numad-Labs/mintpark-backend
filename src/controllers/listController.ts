import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../../custom";
import { CustomError } from "../exceptions/CustomError";
import { listServices } from "../services/listServices";
import { EVM_CONFIG } from "../blockchain/evm/evm-config";
import MarketplaceService from "../blockchain/evm/services/marketplaceService";
import { userRepository } from "../repositories/userRepository";
import { serializeBigInt } from "../blockchain/evm/utils";
import { collectionRepository } from "../repositories/collectionRepository";
import { db } from "../utils/db";
import { MAX_SATOSHI_AMOUNT } from "../blockchain/bitcoin/constants";

import subgraphService from "@blockchain/evm/services/subgraph/subgraphService";
import { LAYER } from "@app-types/db/enums";
import logger from "@config/winston";
import { MarketplaceSyncService } from "@blockchain/evm/services/subgraph/marketplaceSyncService";

// const tradingService = new TradingService(
//   EVM_CONFIG.RPC_URL,
//   EVM_CONFIG.MARKETPLACE_ADDRESS,
//   new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS)
// );

// const marketplaceService = new MarketplaceService(
//   EVM_CONFIG.MARKETPLACE_ADDRESS
// );

export const listController = {
  generateApprovelTransactionOfTrading: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
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

      if (user.layerId !== collection?.layerId)
        throw new CustomError(
          "Please connect to the appropriate L2 for this launch.",
          400
        );
      if (!user.chainId)
        throw new CustomError("User's chainId not found.", 400);

      const chainConfig = EVM_CONFIG.CHAINS[user.chainId];
      const tradingService = new MarketplaceService(
        chainConfig.MARKETPLACE_ADDRESS,
        chainConfig.RPC_URL
      );

      const unsignedTx = await tradingService.getUnsignedApprovalTransaction(
        user?.address,
        collection.contractAddress
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
    next: NextFunction
  ) => {
    try {
      const { collectionId, userLayerId, tokenId } = req.body;
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);
      if (!userLayerId) throw new CustomError("Invalid userLayerId.", 400);
      const issuerId = req.user.id;

      const result = await listServices.checkAndPrepareRegistration(
        collectionId,
        issuerId,
        userLayerId,
        tokenId
      );

      res.status(200).json({ success: true, data: result });
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
  generateTxHexToBuyListedCollectible: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
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
      const { hex, txid, userLayerId } = req.body;
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);
      const result = await listServices.buyListedCollectible(
        id,
        userLayerId,
        hex,
        req.user.id,
        txid
      );
      return res.status(200).json({
        success: true,
        data: { confirmedList: result.confirmedList, txid: result.txid }
      });
    } catch (e) {
      next(e);
    }
  },
  generateCancelListingTx: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);
      const result = await listServices.generateListingCancelTx(
        req.user.id,
        id
      );
      return res.status(200).json({
        success: true,
        data: { result }
      });
    } catch (e) {
      next(e);
    }
  },
  confirmCancelListingTx: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const { txid } = req.body;

      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);
      const result = await listServices.confirmListingCancel(
        req.user.id,
        id,
        txid
      );

      return res.status(200).json({
        success: true,
        data: { result }
      });
    } catch (e) {
      next(e);
    }
  },
  /**
   * Get all marketplace activities (LISTED, SOLD, CANCELED)
   */
  getMarketplaceActivity: async (req: Request, res: Response) => {
    try {
      const {
        chainId = 43111, // Default chain ID
        limit = 20,
        offset = 0,
        sortBy = "blockTimestamp",
        sortDirection = "desc"
      } = req.query;

      const layer = LAYER.HEMI;

      // Validate layer
      if (![LAYER.HEMI].includes(layer)) {
        return res.status(400).json({
          success: false,
          message: "Invalid layer. Supported layers: HEMI, CITREA"
        });
      }

      // Validate chain ID
      const numericChainId = parseInt(chainId as string);
      if (isNaN(numericChainId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid chainId. Must be a number"
        });
      }

      // Validate sortDirection
      if (sortDirection && !["asc", "desc"].includes(sortDirection as string)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid sortDirection. Must be "asc" or "desc"'
        });
      }

      const result = await subgraphService.getMarketplaceActivity(
        layer,
        numericChainId,
        {
          limit: parseInt(limit as string) || 20,
          offset: parseInt(offset as string) || 0,
          sortBy: sortBy as string,
          sortDirection: ((sortDirection as string) || "desc") as "asc" | "desc"
        }
      );

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`Error in getMarketplaceActivity: ${error}`);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch marketplace activities",
        error: (error as Error).message
      });
    }
  },

  getListingById: async (req: Request, res: Response) => {
    try {
      const { listingId } = req.params;
      const { chainId = 43111 } = req.query;

      if (!listingId) {
        return res.status(400).json({
          success: false,
          message: "Listing ID is required"
        });
      }

      // For now, only HEMI layer is supported
      const layer = LAYER.HEMI;

      // Validate chain ID
      const numericChainId = parseInt(chainId as string);
      if (isNaN(numericChainId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid chainId. Must be a number"
        });
      }

      const result = await subgraphService.getListingById(
        layer,
        numericChainId,
        listingId
      );

      if (!result) {
        return res.status(404).json({
          success: false,
          message: `Listing with ID ${listingId} not found`
        });
      }

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`Error in getListingById: ${error}`);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch listing information",
        error: (error as Error).message
      });
    }
  },

  /**
   * Get activities for a specific NFT token
   */
  getTokenActivity: async (req: Request, res: Response) => {
    try {
      const { nftContract, tokenId } = req.params;
      const {
        chainId = 43111,
        limit = 20,
        offset = 0,
        sortBy = "blockTimestamp",
        sortDirection = "desc"
      } = req.query;

      if (!nftContract || !tokenId) {
        return res.status(400).json({
          success: false,
          message: "NFT contract address and token ID are required"
        });
      }

      // For now, only HEMI layer is supported
      const layer = LAYER.HEMI;

      // Validate chain ID
      const numericChainId = parseInt(chainId as string);
      if (isNaN(numericChainId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid chainId. Must be a number"
        });
      }

      // Validate sortDirection
      if (sortDirection && !["asc", "desc"].includes(sortDirection as string)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid sortDirection. Must be "asc" or "desc"'
        });
      }

      const result = await subgraphService.getTokenActivity(
        layer,
        numericChainId,
        nftContract,
        tokenId,
        {
          limit: parseInt(limit as string) || 20,
          offset: parseInt(offset as string) || 0,
          sortBy: sortBy as string,
          sortDirection: ((sortDirection as string) || "desc") as "asc" | "desc"
        }
      );

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`Error in getTokenActivity: ${error}`);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch token activities",
        error: (error as Error).message
      });
    }
  },

  /**
   * Controller for manually triggering marketplace sync operations
   */
  syncMarketplace: async (req: Request, res: Response) => {
    try {
      const marketplaceSyncService = req.app.locals
        .marketplaceSyncService as MarketplaceSyncService;

      if (!marketplaceSyncService) {
        return res.status(500).json({
          success: false,
          message: "Marketplace sync service not initialized"
        });
      }

      // Do not await — run in background
      marketplaceSyncService
        .syncAllListings()
        .then(() => {
          logger.info("Marketplace sync completed.");
        })
        .catch((err) => {
          logger.error(`Marketplace sync failed: ${err}`);
        });

      // Return immediately
      return res.status(202).json({
        success: true,
        message: "Marketplace sync started"
      });
    } catch (error) {
      logger.error(`Error in syncMarketplace: ${error}`);
      return res.status(500).json({
        success: false,
        message: "Failed to initiate sync",
        error: (error as Error).message
      });
    }
  }

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
