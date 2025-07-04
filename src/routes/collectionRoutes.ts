import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { collectionController } from "../controllers/collectionController";
import { parseFiles } from "../middlewares/fileParser";
import { authorize } from "../middlewares/authorize";
import { collectionRepository } from "@repositories/collectionRepository";

const collectionRouter = Router();

// Creator/Admin Priviledge APIs
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

// Service-to-service APIs (internal)
collectionRouter.get("/:id/service", collectionController.getByIdForService);

// Public
collectionRouter.get("/listed", collectionController.getListedCollections);
collectionRouter.get("/:id", collectionController.getById);

export = collectionRouter;
