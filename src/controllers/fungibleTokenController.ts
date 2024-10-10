import { NextFunction, Request, Response } from "express";
import { CustomError } from "../exceptions/CustomError";
import { createFundingAddress } from "../libs/fundingAddress";
import { SERVICE_FEE } from "../libs/constants";
import { orderRepository } from "../repositories/orderRepository";
import { deployBRC20 } from "../libs/bitcoinL1/mintBRC20";
import { AuthenticatedRequest } from "../../custom";

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

      const inscription = {
        inscriptionData: Buffer.from(
          JSON.stringify({
            p: "brc-20",
            op: "deploy",
            tick: brc20Ticker,
            ...(brc20Limit && { lim: brc20Limit }),
            max: brc20Max,
          }),
          "utf-8"
        ),
        inscriptionContentType: "application/json",
      };
      const result = createFundingAddress({
        layerType: mintLayerType,
        inscriptions: [inscription],
        price: SERVICE_FEE,
        feeRate: feeRate,
      });

      let orders = await orderRepository.getPendingUserOrdersByLayerType(
        req.user.address,
        mintLayerType
      );
      if (orders.length > 0)
        throw new CustomError("You already have a pending order.", 400);
      const order = await orderRepository.create({
        user_address: deployerAddress,
        funding_address: result.address,
        funding_private_key: result.privateKey,
        amount: result.requiredAmount,
        service_fee: SERVICE_FEE,
        network_fee: result.requiredAmount - SERVICE_FEE,
        feeRate: feeRate,
        layer_type: mintLayerType,
        minting_type: "BRC20",
        quantity: brc20Max,
      });

      return res.status(200).json({
        success: true,
        data: {
          order_id: order.order_id,
          fundingAddress: order.funding_address,
          requiredAmountToFund: order.amount,
          serviceFee: order.service_fee,
          networkFee: order.network_fee,
          feeRate: order.feeRate,
          mintLayerType: order.layer_type,
          status: order.status,
          quantity: order.quantity,
        },
      });
    } catch (e) {
      next(e);
    }
  },
  deploy: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { deployerAddress, brc20Ticker, brc20Max, brc20Limit, orderId } =
        req.body;

      if (!deployerAddress || !brc20Ticker || !brc20Max || !brc20Limit)
        throw new CustomError("Please provide all required fields", 400);

      const order = await orderRepository.getById(orderId);
      if (!order) throw new CustomError("Order not found", 404);

      // if (order.userAddress !== deployerAddress)
      //     throw new CustomError("You are not allowed to do this action.", 403);

      const deploymentResult = await deployBRC20(
        {
          tick: brc20Ticker,
          max: brc20Max,
          lim: brc20Limit,
          address: deployerAddress,
          fundingAddress: order.funding_address,
          fundingPrivateKey: order.funding_private_key,
        },
        order.feeRate
      );

      return res.status(200).json({
        success: true,
        data: {
          ...deploymentResult,
        },
      });
    } catch (e) {
      next(e);
    }
  },
};
