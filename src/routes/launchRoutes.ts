import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { launchController } from "../controllers/launchController";
import { authorize } from "../middlewares/authorize";

const launchRouter = Router();

launchRouter.get("/", launchController.getAllLaunchedCollectionsByLayerId);
launchRouter.get(
  "/collections/:collectionId",
  launchController.getLaunchedCollectionById
);
launchRouter.post(
  "/collections/:collectionId/create-order",
  authenticateToken,
  launchController.generateBuyOrderForLaunchedCollection
);
launchRouter.post(
  "/invoke-order",
  authenticateToken,
  launchController.invokeOrder
);
launchRouter.post(
  "/change-mintfee-transaction",
  authenticateToken,
  // authorize("SUPER_ADMIN"),
  launchController.generateUnsignedMintPriceChangeTx
);
// launchRouter.put("/:id", authenticateToken, launchController.update);
export = launchRouter;
