import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { launchController } from "../controllers/launchController";
import { authorize } from "../middlewares/authorize";
import { parseFiles } from "../middlewares/fileParser";

const launchRouter = Router();

launchRouter.get("/", launchController.getAllLaunchesByLayerId);
launchRouter.get(
  "/collections/:collectionId",
  launchController.getLaunchByCollectionId
);
// launchRouter.post(
//   "/collections/:collectionId/create-order",
//   authenticateToken,
//   launchController.generateBuyOrderForLaunchedCollection
// );
// launchRouter.post(
//   "/invoke-order",
//   authenticateToken,
//   launchController.invokeOrder
// );
launchRouter.post(
  "/change-mintfee-transaction",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  launchController.generateUnsignedMintPriceChangeTx
);
// launchRouter.put("/:id", authenticateToken, launchController.update);

launchRouter.post(
  "/",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  launchController.create
);
launchRouter.post(
  "/inscription",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  parseFiles("files", false),
  launchController.createInscriptionAndLaunchItemsInBatch
);
launchRouter.post(
  "/recursive-inscription",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  launchController.createRecursiveInscriptionAndLaunchItemsInBatch
);
launchRouter.post(
  "/ipfs",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  launchController.createIpfsNftAndLaunchItemsInBatch
);
launchRouter.post("/:id/buy", authenticateToken, launchController.buy);
launchRouter.post("/mint", authenticateToken, launchController.mint);

export = launchRouter;
