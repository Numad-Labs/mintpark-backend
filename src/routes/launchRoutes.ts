import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { launchController } from "../controllers/launchController";
import { authorize } from "../middlewares/authorize";
import { parseFiles } from "../middlewares/fileParser";

const launchRouter = Router();

/* launchRouter.get("/", launchController.getAllLaunchedCollectionsByLayerId);
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
); */
// launchRouter.put("/:id", authenticateToken, launchController.update);

launchRouter.post("/", authenticateToken, launchController.create);
launchRouter.post(
  "/inscription",
  authenticateToken,
  parseFiles("files", false),
  launchController.createInscriptionAndLaunchItemsInBatch
);
launchRouter.post(
  "/recursive-inscription",
  authenticateToken,
  launchController.createRecursiveInscriptionAndLaunchItemsInBatch
);
launchRouter.post(
  "/ipfs",
  authenticateToken,
  launchController.createIpfsNftAndLaunchItemsInBatch
);
launchRouter.post("/:id/buy", authenticateToken, launchController.buy);
launchRouter.post("/mint", authenticateToken, launchController.mint);

export = launchRouter;
