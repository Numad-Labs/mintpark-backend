import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { launchController } from "../controllers/launchController";
import { authorize } from "../middlewares/authorize";
import { parseFiles } from "../middlewares/fileParser";
import { launchRatelimiter } from "../middlewares/rateLimiter";
// import { launchRatelimiter } from "../middlewares/rateLimiter";

const launchRouter = Router();

// launchRouter.get("/state-function-test", launchController.stateFunctionTest);

launchRouter.get("/", launchController.getAllLaunchesByLayerId);
launchRouter.get(
  "/collections/:collectionId",
  launchController.getLaunchByCollectionId
);

launchRouter.post(
  "/",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  parseFiles("badge", true),
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
launchRouter.post(
  "/ipfs-file",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  parseFiles("files", false),
  launchController.createIpfsFileAndLaunchItemsInBatch
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
launchRouter.post(
  "/whitelist-addresses",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  launchController.addWhitelistAddress
);

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
