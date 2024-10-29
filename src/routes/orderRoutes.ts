import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { orderController } from "../controllers/orderController";
import { parseFiles } from "../middlewares/fileParser";

const orderRouter = Router();

orderRouter.post(
  "/collectible",
  authenticateToken,
  parseFiles("file", true),
  orderController.createCollectible
);

orderRouter.post(
  "/collection",
  authenticateToken,
  parseFiles("files", false),
  orderController.createCollection
);

orderRouter.get("/user/:userId", orderController.getByUserId);
orderRouter.get("/:orderId", orderController.getById);

orderRouter.get("/:orderId/payment-status", orderController.checkOrderIsPaid);

export = orderRouter;
