import { NextFunction, Request, Response } from "express";
import { CustomError } from "../exceptions/CustomError";
import { createFundingAddress } from "../libs/fundingAddress";
import { ASSETTYPE, SERVICE_FEE, SERVICE_FEE_ADDRESS } from "../libs/constants";
import { orderRepository } from "../repositories/orderRepository";
import { deployBRC20 } from "../libs/bitcoinL1/mintBRC20";
import { AuthenticatedRequest } from "../../custom";
import { fungibleTokenServices } from "../services/fungibleTokenServices";
import { mint } from "../libs/coordinate/mint";
import { getObjectFromS3 } from "../utils/aws";
import { mintHelper } from "../libs/mintHelper";

export const fungibleTokenController = {
  createOrder: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user)
        throw new CustomError("Could not retrieve id from the token", 400);
      const deployerAddress = req.user?.address;
      const { brc20Ticker, brc20Max, brc20Limit, feeRate, mintLayerType } =
        req.body;

      if (
        !brc20Ticker ||
        !brc20Max ||
        !brc20Limit ||
        !mintLayerType ||
        !feeRate
      )
        throw new CustomError("Please provide all required fields", 400);

      const order = await fungibleTokenServices.createOrder(
        brc20Ticker,
        brc20Max,
        brc20Limit,
        SERVICE_FEE,
        mintLayerType,
        feeRate,
        deployerAddress
      );

      return res.status(200).json({
        success: true,
        data: {
          orderId: order.orderId,
          fundingAddress: order.fundingAddress,
          serviceFee: order.serviceFee,
          networkFee: order.networkFee,
          requiredAmountToFund: order.amount,
          feeRate: order.feeRate,
          mintLayerType: order.layerType,
          mintingType: order.mintingType,
          status: order.status,
          quantity: order.quantity,
        },
      });
    } catch (e) {
      next(e);
    }
  },
  deploy: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user)
        throw new CustomError("Could not retrieve id from the token", 400);
      const deployerAddress = req.user?.address;
      const { orderId } = req.body;
      const order = await orderRepository.getById(orderId);
      if (!order) throw new CustomError("Order not found", 404);
      if (order.userAddress !== deployerAddress)
        throw new CustomError("You are not allowed to do this action.", 403);

      if (order.status !== "PENDING")
        throw new CustomError("Order is not pending.", 400);

      if (order.mintingType !== "BRC20" || !order.collectibleKey)
        throw new CustomError("Order is not for BRC20 deploy.", 400);

      const file = await getObjectFromS3(order.collectibleKey);

      const inscriptionContent = JSON.parse(file.content.toString());
      console.log(inscriptionContent);
      const deployResult = await deployBRC20(
        {
          tick: inscriptionContent.tick,
          max: inscriptionContent.max,
          lim: inscriptionContent.limit,
          address: deployerAddress,
          fundingAddress: order.fundingAddress,
          fundingPrivateKey: order.fundingPrivateKey,
        },
        order.feeRate
      );
      order.status = "INSCRIBED";
      await orderRepository.updateOrderStatus(
        order.orderId,
        deployResult.revealTxId
      );

      return res.status(200).json({
        success: true,
        data: {
          orderId: order.orderId,
          orderStatus: "INSCRIBED",
          deployResult,
        },
      });
    } catch (e) {
      next(e);
    }
  },
};
