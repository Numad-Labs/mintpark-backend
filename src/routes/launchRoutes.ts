import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { launchController } from "../controllers/launchController";
import { authorize } from "../middlewares/authorize";
import { parseFiles } from "../middlewares/fileParser";
import { launchRatelimiter } from "../middlewares/rateLimiter";

const launchRouter = Router();

launchRouter.get("/", launchController.getAllLaunchesByLayerId);
launchRouter.get(
  "/collections/:collectionId",
  launchController.getLaunchByCollectionId
);

launchRouter.post(
  "/:id/buy",
  authenticateToken,
  launchRatelimiter,
  launchController.buy
);
launchRouter.post(
  "/mint",
  authenticateToken,
  launchRatelimiter,
  launchController.mint
);

// Creator APIs
launchRouter.post(
  "/",
  authenticateToken,
  parseFiles("badge", true),
  launchController.create
);
// launchRouter.post(
//   "/inscription",
//   authenticateToken,
//   parseFiles("files", false),
//   launchController.createInscriptionAndLaunchItemsInBatch
// );
launchRouter.post(
  "/ipfs-file",
  authenticateToken,
  parseFiles("files", false),
  launchController.createIpfsFileAndLaunchItemsInBatch
);
// list of CIDs
launchRouter.post(
  "/ipfs",
  authenticateToken,
  launchController.createIpfsNftAndLaunchItemsInBatch
);
launchRouter.post(
  "/recursive-inscription",
  authenticateToken,
  launchController.createRecursiveInscriptionAndLaunchItemsInBatch
);

launchRouter.post(
  "/whitelist-addresses",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  launchController.addWhitelistAddress
);

// Admin Priviledge APIs
launchRouter.post(
  "/reconcile",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  launchController.reconcileLaunchItemState
);

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
