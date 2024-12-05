import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { orderController } from "../controllers/orderController";
import { parseFiles } from "../middlewares/fileParser";
import { authorize } from "../middlewares/authorize";

const orderRouter = Router();

/* orderRouter.post(
  "/collectible",
  authenticateToken,
  // authorize("SUPER_ADMIN"),
  parseFiles("file", true),
  orderController.createCollectible
);

orderRouter.post(
  "/collection",
  authenticateToken,
  // authorize("SUPER_ADMIN"),
  parseFiles("files", false),
  orderController.createCollection
);

orderRouter.post(
  "/collection/hex",
  authenticateToken,
  // authorize("SUPER_ADMIN"),
  orderController.generateMintTxHex
);

orderRouter.get(
  "/user/:userId",
  authenticateToken,
  orderController.getByUserId
);
orderRouter.get("/:orderId", authenticateToken, orderController.getById);
orderRouter.get(
  "/:orderId/payment-status",
  authenticateToken,
  orderController.checkOrderIsPaid
); */

export = orderRouter;
