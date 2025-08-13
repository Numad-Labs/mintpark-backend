import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { collectionController } from "../controllers/collectionController";
import { parseFiles } from "../middlewares/fileParser";
import { authorize } from "../middlewares/authorize";
import { collectionRepository } from "@repositories/collectionRepository";
import { apiKeyAuth } from "@middlewares/apiKeyAuth";

const collectionRouter = Router();

// Creator/Admin Priviledge APIs
collectionRouter.get(
  "/creator-owned",
  authenticateToken,
  collectionController.getCreatorOwnedCollections
);

collectionRouter.get(
  "/:id/inscription-progress",
  authenticateToken,
  collectionController.getInscriptionProgress
);

collectionRouter.put(
  "/:orderId/mark-as-ran-out-of-funds",
  apiKeyAuth,
  collectionController.markAsRanOutOfFunds
);

collectionRouter.post(
  "/:id/initiate-upload-session",
  authenticateToken,
  collectionController.initiateUploadSessions
);

collectionRouter.get(
  "/:id/upload-session",
  authenticateToken,
  collectionController.getUploadSessionByCollectionId
);

collectionRouter.post(
  "/",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  parseFiles("logo", true),
  collectionController.create
);

collectionRouter.post(
  "/phase",
  authenticateToken,
  collectionController.addPhase
);

collectionRouter.post(
  "/:id/submit-for-review",
  authenticateToken,
  collectionController.submitLaunchForReview
);

collectionRouter.put(
  "/phase",
  authenticateToken,
  collectionController.updatePhase
);

collectionRouter.put(
  "/phase/confirm",
  authenticateToken,
  collectionController.confirmUpdatePhase
);
collectionRouter.get(
  "/phase",
  authenticateToken,
  collectionController.getPhasesByContractAddress
);

collectionRouter.put(
  "/:id/details",
  authenticateToken,
  collectionController.updateDetails
);

collectionRouter.post(
  "/:id/restart-inscription",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  collectionController.restartInscriptionQueue
);

// collectionRouter.post(
//   "/:id/stop-and-withdraw",
//   authenticateToken,
//   collectionController.stopAndWithdraw
// );

collectionRouter.post(
  "/:id/withdraw",
  authenticateToken,
  collectionController.withdraw
);

// Service-to-service APIs (internal)
collectionRouter.get("/:id/service", collectionController.getByIdForService);

// Public
collectionRouter.get("/listed", collectionController.getListedCollections);
collectionRouter.get("/:id", collectionController.getById);

export = collectionRouter;
