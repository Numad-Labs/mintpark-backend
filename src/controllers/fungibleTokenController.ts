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
          orderId: order.order_id,
          fundingAddress: order.funding_address,
          serviceFee: order.service_fee,
          networkFee: order.network_fee,
          requiredAmountToFund: order.amount,
          feeRate: order.feeRate,
          mintLayerType: order.layer_type,
          mintingType: order.minting_type,
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
      if (order.user_address !== deployerAddress)
        throw new CustomError("You are not allowed to do this action.", 403);

      if (order.status !== "PENDING")
        throw new CustomError("Order is not pending.", 400);

      if (order.minting_type !== "BRC20" || !order.collectible_key)
        throw new CustomError("Order is not for BRC20 deploy.", 400);

      const file = await getObjectFromS3(order.collectible_key);

      const inscriptionContent = JSON.parse(file.content.toString());
      console.log(inscriptionContent);
      const deployResult = await deployBRC20(
        {
          tick: inscriptionContent.tick,
          max: inscriptionContent.max,
          lim: inscriptionContent.limit,
          address: deployerAddress,
          fundingAddress:
            "tb1pffk5397d7sns6mayud03nf3fxy4p04e3alhslr6epaq3a788tsuqpw7qeu",
          fundingPrivateKey:
            "8736c95006362c182c82fa937eaab90c1a7dfc6057402fd83a7c89f557fdd770",
        },
        order.feeRate
      );
      order.status = "INSCRIBED";
      await orderRepository.updateOrderStatus(
        order.order_id,
        deployResult.revealTxId
      );

      return res.status(200).json({
        success: true,
        data: {
          orderId: order.order_id,
          status: order.status,
          deployResult,
        },
      });
    } catch (e) {
      next(e);
    }
  },
};
