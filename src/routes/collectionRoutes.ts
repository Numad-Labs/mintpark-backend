import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { collectionController } from "../controllers/collectionController";
import { parseFiles } from "../middlewares/fileParser";
import { authorize } from "../middlewares/authorize";

const collectionRouter = Router();

collectionRouter.get("/listed", collectionController.getListedCollections);
collectionRouter.get("/:id", collectionController.getById);

// Creator/Admin Priviledge APIs
collectionRouter.post(
  "/",
  authenticateToken,
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

export = collectionRouter;
