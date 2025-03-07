import { Router } from "express";
import { collectibleControllers } from "../controllers/collectibleController";
import {
  authenticateToken,
  optionalAuth
} from "../middlewares/authenticateToken";
import { parseFiles } from "../middlewares/fileParser";
import { authorize } from "../middlewares/authorize";
// import { collectibleslimiter } from "../middlewares/rateLimiter";

const collectibleRouter = Router();

collectibleRouter.get(
  "/collectibles-for-ipfs-upload",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  collectibleControllers.getCollectiblesForIpfsUpload
);

collectibleRouter.post(
  "/ipfs-file-upload",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  collectibleControllers.uploadFileToIpfs
);

collectibleRouter.post(
  "/traits-insertion",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  collectibleControllers.insertTraits
);

collectibleRouter.get(
  "/:userId/listable",
  // authenticateToken,
  // collectibleslimiter,
  collectibleControllers.getListableCollectibles
);
collectibleRouter.get(
  "/:collectionId/collection/listable",
  optionalAuth(),
  collectibleControllers.getListableCollectiblesByCollectionId
);
collectibleRouter.get(
  "/:id",
  optionalAuth(),
  collectibleControllers.getCollectibleById
);
collectibleRouter.get(
  "/:collectibleId/activity",
  collectibleControllers.getTokenActivity
);

// collectibleRouter.put("/:id", collectibleControllers.update);

collectibleRouter.post(
  "/inscription",
  authenticateToken,
  parseFiles("files", false),
  authorize("SUPER_ADMIN"),
  collectibleControllers.createInscriptionInBatch
);
collectibleRouter.post(
  "/recursive-inscription",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  collectibleControllers.createRecursiveInscriptionInBatch
);
collectibleRouter.post(
  "/ipfs",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  collectibleControllers.createIpfsNftInBatch
);

// collectibleRouter.post(
//   "/inscribe",
//   parseFiles("file", true),
//   collectibleControllers.inscribe
// );

export = collectibleRouter;
