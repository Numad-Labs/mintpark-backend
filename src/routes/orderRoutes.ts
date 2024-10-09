import { orderController } from "../controllers/orderController";
import express from "express";
import { authenticateToken } from "../middlewares/authenticateToken";

const orderRouter = express.Router();

orderRouter.get(
  "/:layerType",
  authenticateToken,
  orderController.getUserOrdersByLayerType
);
orderRouter.get("/:orderId", orderController.getByOrderId);
orderRouter.get("/fee-rates/:layerType", orderController.getFeeRates);
orderRouter.get("/fee-rates", orderController.getAllFeeRates);
export = orderRouter;
