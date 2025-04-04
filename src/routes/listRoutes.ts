import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { listController } from "../controllers/listController";
import { authorize } from "../middlewares/authorize";
const listRouter = Router();

listRouter.post("/", authenticateToken, listController.listCollectible);
listRouter.post(
  "/approval",
  authenticateToken,
  listController.generateApprovelTransactionOfTrading
);
listRouter.post(
  "/checkRegistration",
  authenticateToken,
  listController.checkRegistration
);

listRouter.post(
  "/:id/confirm",
  authenticateToken,
  listController.confirmPendingList
);
listRouter.post(
  "/:id/generate-hex",
  authenticateToken,
  listController.generateTxHexToBuyListedCollectible
);
listRouter.post(
  "/:id/buy",
  authenticateToken,
  listController.buyListedCollectible
);
listRouter.post(
  "/:id/generate-cancel-listing-tx",
  authenticateToken,
  listController.generateCancelListingTx
);
listRouter.post(
  "/:id/confirm-cancel-listing",
  authenticateToken,
  listController.confirmCancelListingTx
);

// listRouter.get(
//   "/:id/estimate-fee",
//   authenticateToken,
//   listController.getEstimatedFee
// );

export = listRouter;
