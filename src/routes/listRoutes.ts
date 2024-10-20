import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { listController } from "../controllers/listController";
const listRouter = Router();

listRouter.post("/", authenticateToken, listController.listCollectible);
listRouter.post(
  "/:id/confirm",
  authenticateToken,
  listController.confirmPendingList
);
listRouter.post(
  "/:id/generate-hex",
  authenticateToken,
  listController.generatePsbtHexToBuyListedCollectible
);
listRouter.post(
  "/:id/buy",
  authenticateToken,
  listController.buyListedCollectible
);
listRouter.get(
  "/:id/estimate-fee",
  authenticateToken,
  listController.getEstimatedFee
);

export = listRouter;
