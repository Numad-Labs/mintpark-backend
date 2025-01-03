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
launchRouter.post(
  "/change-mintfee-transaction",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  launchController.generateUnsignedMintPriceChangeTx
);

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

// launchRouter.post(
//   "/create-order-for-reserved-items",
//   authenticateToken,
//   authorize("SUPER_ADMIN"),
//   launchController.createOrderForReservedLaunchItems
// );
// launchRouter.post(
//   "/invoke-minting-for-reserved-items",
//   authenticateToken,
//   authorize("SUPER_ADMIN"),
//   launchController.invokeMintingForReservedLaunchItems
// );

export = launchRouter;
