import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { collectionController } from "../controllers/collectionController";
import { parseFiles } from "../middlewares/fileParser";
import { authorize } from "../middlewares/authorize";
import { collectionRepository } from "@repositories/collectionRepository";

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
  "/:id/stop-and-withdraw",
  authenticateToken,
  collectionController.stopAndWithdraw
);

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
