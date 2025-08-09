import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../custom";
import { orderServices } from "../services/orderServices";
import { CustomError } from "../exceptions/CustomError";
import { hideSensitiveData } from "../libs/hideDataHelper";
import { orderRepository } from "@repositories/orderRepostory";
import { db } from "@utils/db";
import { collectionProgressServices } from "@services/collectionProgressServices";
import { collectionProgressRepository } from "@repositories/collectionProgressRepository";
import {
  deleteRanOutOfFundsFlagByOrderIds,
  isCollectionRanOutOfFunds
} from "@queue/queueProcessServiceAPIs";
import { collectionRepository } from "@repositories/collectionRepository";
import { layerRepository } from "@repositories/layerRepository";
import { getPSBTBuilder } from "@blockchain/bitcoin/PSBTBuilder";
import { traitValueRepository } from "@repositories/traitValueRepository";
import { collectibleRepository } from "@repositories/collectibleRepository";

export const orderController = {
  createMintOrder: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const {
        estimatedTxSizeInVBytes,
        totalDustValue,
        orderSplitCount,
        collectionId,
        txid,
        userLayerId
      } = req.body;

      if (!req.user?.id)
        throw new CustomError("Cannot parse user from token", 401);
      if (!estimatedTxSizeInVBytes)
        throw new CustomError("estimatedTxSizeInVbytes is required.", 400);
      if (!totalDustValue)
        throw new CustomError("totalDustValue is required.", 400);
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
        Number(estimatedTxSizeInVBytes),
        Number(totalDustValue),
        orderSplitCount,
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
      if (!order.collectionId)
        throw new CustomError("Order with no collection id", 400);

      const collection = await collectionRepository.getById(
        db,
        order.collectionId
      );
      if (!collection) throw new CustomError("Collection not found", 400);

      const layer = await layerRepository.getById(collection.layerId);
      if (!layer) throw new CustomError("Layer not found", 400);

      const psbtBuilder = getPSBTBuilder(
        layer.network === "MAINNET" ? "mainnet" : "testnet"
      );

      let balance = (await psbtBuilder.getBalance(order.fundingAddress)).total;
      if (balance < order.fundingAmount)
        throw new CustomError("Please fund the order first", 400);

      await collectionProgressServices.update(order.collectionId, {
        paymentCompleted: true
      });

      return res.status(200).json({ success: true, data: { isPaid: true } });
    } catch (e) {
      next(e);
    }
  },
  expireIncompleteOrder: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Cannot parse user from token", 401);
      const { collectionId } = req.params;

      const order = await orderRepository.getByCollectionId(collectionId);
      if (!order)
        throw new CustomError("No orders found for this collections", 400);

      const collectionProgress = await collectionProgressRepository.getById(
        collectionId
      );
      if (!collectionProgress)
        throw new CustomError("Collection progress not found", 400);
      const isPaymentInitialized =
        collectionProgress.paymentInitialized &&
        !collectionProgress.paymentCompleted;
      if (!isPaymentInitialized)
        throw new CustomError("Invalid collection progress state", 400);

      await orderRepository.expireByCollectionId(db, collectionId);

      return res.status(200).json({
        success: true,
        message: "Successfully expired incomplete orders"
      });
    } catch (e) {
      next(e);
    }
  },
  getBaseOrderByCollectionId: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Cannot parse user from token", 401);
      const { collectionId } = req.params;

      const order = await orderRepository.getBaseByCollectionId(collectionId);
      if (!order) throw new CustomError("Order not found", 400);
      if (!order.fundingAddress)
        throw new CustomError("Order does not have funding address", 400);
      if (!order.collectionId)
        throw new CustomError("Order with no collection id", 400);

      const collectionProgress = await collectionProgressRepository.getById(
        order.collectionId
      );
      if (!collectionProgress)
        throw new CustomError("Collection progress not found", 400);

      const walletQrString = `bitcoin:${order.fundingAddress}?amount=${
        Number(collectionProgress.retopAmount ?? 0) / 10 ** 8
      }`;

      return res.status(200).json({
        success: true,
        data: {
          id: order.id,
          walletQrString,
          fundingAddress: order.fundingAddress,
          retopAmount: collectionProgress.retopAmount
        }
      });
    } catch (e) {
      next(e);
    }
  },
  retopFunding: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Cannot parse user from token", 401);
      const { collectionId } = req.params;

      const order = await orderRepository.getBaseByCollectionId(collectionId);
      if (!order) throw new CustomError("Order not found", 400);
      if (!order.fundingAddress || !order.privateKey)
        throw new CustomError(
          "Order does not have funding address or private key",
          400
        );
      if (!order.collectionId)
        throw new CustomError("Order with no collection id", 400);

      const collectionProgress = await collectionProgressRepository.getById(
        order.collectionId
      );
      if (!collectionProgress)
        throw new CustomError("Collection progress not found", 400);
      if (!collectionProgress.ranOutOfFunds || !collectionProgress.retopAmount)
        throw new CustomError("Collection has not been ran out of funds.", 400);

      const collection = await collectionRepository.getById(
        db,
        order.collectionId
      );
      if (!collection) throw new CustomError("Collection not found", 400);

      const layer = await layerRepository.getById(collection.layerId);
      if (!layer) throw new CustomError("Layer not found", 400);

      const psbtBuilder = getPSBTBuilder(
        layer.network === "MAINNET" ? "mainnet" : "testnet"
      );

      let balance = (await psbtBuilder.getBalance(order.fundingAddress)).total;
      if (balance < collectionProgress.retopAmount)
        throw new CustomError("Please fund the order first", 400);

      const [
        undoneTraitValuesStats,
        undoneRecursiveCollectiblesStats,
        undoneOOOEditionCollectiblesStats
      ] = await Promise.all([
        traitValueRepository.getUndoneTraitValuesStatsByCollectionId(
          order.collectionId
        ),
        collectibleRepository.getUndoneRecursiveCollectiblesStatsByCollectionId(
          order.collectionId
        ),
        collectibleRepository.getUndoneOOOEditionCollectiblesStatsByCollectionId(
          order.collectionId
        )
      ]);

      const orders =
        await orderRepository.getOrdersByCollectionIdAndMintRecursiveCollectibleType(
          collectionId
        );
      const outputs: { address: string; amount: number }[] = [];
      const totalUndoneItemCount =
        undoneTraitValuesStats.count +
        undoneRecursiveCollectiblesStats.count +
        undoneOOOEditionCollectiblesStats.count;

      // If totalUndoneItemCount is low, don't split to prevent inefficient fee splitting
      if (totalUndoneItemCount < order.orderSplitCount * 5) {
        const estimatedFee = psbtBuilder.estimateFee(
          1,
          1,
          "p2tr",
          order.feeRate
        );
        const retopAmountInSats = Math.floor(
          collectionProgress.retopAmount - estimatedFee * 1.25
        );
        outputs.push({
          address: order.fundingAddress,
          amount: retopAmountInSats
        });
      } else {
        const estimatedFee = psbtBuilder.estimateFee(
          1,
          order.orderSplitCount,
          "p2tr",
          order.feeRate
        );
        const splitRetopAmountInSats = Math.floor(
          (collectionProgress.retopAmount - estimatedFee * 1.25) /
            order.orderSplitCount
        );
        orders.forEach((order) =>
          outputs.push({
            address: order.fundingAddress!,
            amount: splitRetopAmountInSats
          })
        );
      }

      const txHex = await psbtBuilder.generateTxHex({
        outputs,
        fundingAddress: order.fundingAddress,
        fundingPrivateKey: order.privateKey,
        feeRate: order.feeRate
      });

      await collectionProgressServices.update(collectionId, {
        ranOutOfFunds: false,
        retopAmount: 0
      });
      await deleteRanOutOfFundsFlagByOrderIds(orders.map((order) => order.id));
      await psbtBuilder.broadcastTransaction(txHex);

      return res.status(200).json({
        success: true,
        message: "Successfully retopped the inscription queue"
      });
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
