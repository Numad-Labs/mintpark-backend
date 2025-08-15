import { Router } from "express";
import { collectibleControllers } from "../controllers/collectibleController";
import {
  authenticateToken,
  optionalAuth
} from "../middlewares/authenticateToken";
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
// collectibleRouter.get(
//   "/:collectibleId/build-image",
//   authenticateToken,
//   collectibleControllers.buildNftImageFromTraits
// );

// Admin Priviledge APIs, will later be allowed
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

// // Admin Queue Priviledge APIs
// collectibleRouter.get(
//   "/:collectionId/no-cid/enqueue",
//   authenticateToken,
//   authorize("SUPER_ADMIN"),
//   collectibleControllers.getCollectiblesWithNoCidAndEnqueue
// );

// Service-to-service APIs (internal)
// IPFS Queue
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

collectibleRouter.get(
  "/collectibles-for-ipfs-upload/for-restart",
  apiKeyAuth,
  collectibleControllers.getCollectiblesForIpfsUpload
);

// Inscription Queue
collectibleRouter.get(
  "/count-without-parent-and-not-ooo/for-service",
  apiKeyAuth,
  collectibleControllers.countWithoutParentAndNotOoo
);

collectibleRouter.get(
  "/count-without-parent/for-service",
  apiKeyAuth,
  collectibleControllers.countWithoutParent
);

collectibleRouter.get(
  "/service/:collectionId/1-of-1",
  apiKeyAuth,
  collectibleControllers.getRandomOOOEditionCollectibleByCollectionIdForService
);
collectibleRouter.get(
  "/service/:collectionId/recursive",
  apiKeyAuth,
  collectibleControllers.getRandomRecursiveCollectibleByCollectionIdForService
);

collectibleRouter.post(
  "/:collectibleId/recursive",
  apiKeyAuth,
  collectibleControllers.createRecursiveCollectible
);

// Event & Collection Listing Processor
collectibleRouter.get(
  "/service/:uniqueIdx/unique-index",
  apiKeyAuth,
  collectibleControllers.getCollectibleByUniqueIdxAndLayerIdForService
);

collectibleRouter.post(
  "/service/l2-only",
  apiKeyAuth,
  collectibleControllers.createL2OnlyCollectible
);

collectibleRouter.put(
  "/service/:collectibleId/mark-as-burned",
  apiKeyAuth,
  collectibleControllers.markCollectibleAsBurnedByCollectibleId
);

// Script APIs
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
