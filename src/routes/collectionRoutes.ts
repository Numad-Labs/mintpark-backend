import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { collectionController } from "../controllers/collectionController";
import { parseFiles } from "../middlewares/fileParser";

const collectionRouter = Router();

collectionRouter.post(
  "/",
  authenticateToken,
  parseFiles("logo", true),
  collectionController.create
);

collectionRouter.post(
  "/:collectionId/launch",
  authenticateToken,
  parseFiles("files", false),
  collectionController.launchCollection
);

collectionRouter.get("/", collectionController.getAllLaunchedCollections);
collectionRouter.get("/listed", collectionController.getListedCollections);
collectionRouter.get(
  "/layer/:layerId",
  collectionController.getAllLaunchedCollectionsByLayerId
);
collectionRouter.get("/:collectionId", collectionController.getById);

export = collectionRouter;
