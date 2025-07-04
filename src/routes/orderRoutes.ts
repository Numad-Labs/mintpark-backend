import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { orderController } from "../controllers/orderController";
import { parseFiles } from "../middlewares/fileParser";
import { authorize } from "../middlewares/authorize";
import { apiKeyAuth } from "@middlewares/apiKeyAuth";

const orderRouter = Router();

orderRouter.post(
  "/",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  parseFiles("badge", true),
  orderController.createMintOrder
);
orderRouter.post(
  "/:id/invoke-mint",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  orderController.invokeOrderForMinting
);

orderRouter.get(
  "/user/:userId",
  authenticateToken,
  orderController.getByUserId
);
orderRouter.get("/:orderId", authenticateToken, orderController.getById);

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
  "/:orderId/payment-status",
  authenticateToken,
  orderController.checkOrderIsPaid
); */

// Service-to-service APIs (internal)
orderRouter.get(
  "/:collectionId/details",
  apiKeyAuth,
  orderController.getByCollectionIdWithDetailForService
);

export = orderRouter;
