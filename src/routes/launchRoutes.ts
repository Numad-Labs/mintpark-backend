import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { launchController } from "../controllers/launchController";

const launchRouter = Router();

launchRouter.get("/", launchController.getAllLaunchedCollectionsByLayerId);
launchRouter.get(
  "/collections/:collectionId",
  launchController.getLaunchedCollectionById
);
launchRouter.post(
  "/collections/:collectionId/create-order",
  authenticateToken,
  launchController.generateOrderForLaunchedCollection
);
launchRouter.post(
  "/invoke-order",
  authenticateToken,
  launchController.invokeOrder
);
// launchRouter.post(
//   "/:id/generate-citrea-buy",
//   authenticateToken,
//   launchController.generateCitreaBuyHex
// );
export = launchRouter;
