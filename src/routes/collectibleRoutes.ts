import { Router } from "express";
import { collectibleControllers } from "../controllers/collectibleController";
import {
  authenticateToken,
  optionalAuth
} from "../middlewares/authenticateToken";
import { parseFiles } from "../middlewares/fileParser";
import { authorize } from "../middlewares/authorize";
import { apiKeyAuth } from "../middlewares/apiKeyAuth";

const collectibleRouter = Router();

collectibleRouter.get(
  "/:collectionId/collection/listable",
  optionalAuth(),
  collectibleControllers.getListableCollectiblesByCollectionId
);

collectibleRouter.get(
  "/:collectionId/activity",
  collectibleControllers.getCollectionActivity
);

collectibleRouter.get(
  "/:userId/listable",
  authenticateToken,
  collectibleControllers.getListableCollectibles
);
collectibleRouter.get(
  "/:id",
  optionalAuth(),
  collectibleControllers.getCollectibleById
);
collectibleRouter.get(
  "/collectible/:collectibleId/activity",
  collectibleControllers.getTokenActivity
);

// Creator APIs
collectibleRouter.get(
  "/:collectibleId/build-image",
  authenticateToken,
  collectibleControllers.buildNftImageFromTraits
);

// // Admin Priviledge APIs, will later be allowed
// collectibleRouter.post(
//   "/inscription",
//   authenticateToken,
//   parseFiles("files", false),
//   authorize("SUPER_ADMIN"),
//   collectibleControllers.createInscriptionInBatch
// );
// collectibleRouter.post(
//   "/recursive-inscription",
//   authenticateToken,
//   authorize("SUPER_ADMIN"),
//   collectibleControllers.createRecursiveInscriptionInBatch
// );
// collectibleRouter.post(
//   "/ipfs",
//   authenticateToken,
//   authorize("SUPER_ADMIN"),
//   collectibleControllers.createIpfsNftInBatch
// );

// Admin Queue Priviledge APIs
collectibleRouter.get(
  "/:collectionId/no-cid/enqueue",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  collectibleControllers.getCollectiblesWithNoCidAndEnqueue
);

// Inter-Service Communication APIs
collectibleRouter.post(
  "/update-ipfs",
  apiKeyAuth,
  collectibleControllers.updateIpfs
);

collectibleRouter.get(
  "/service/:collectibleId",
  apiKeyAuth,
  collectibleControllers.getCollectibleByIdForService
);

collectibleRouter.get(
  "/service/:collectibleId/build-from-traits",
  apiKeyAuth,
  collectibleControllers.buildNftImageFromTraits
);

// Script APIs
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

export = collectibleRouter;
