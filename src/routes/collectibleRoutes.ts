import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { collectionController } from "../controllers/collectionController";
import { parseFiles } from "../middlewares/fileParser";
import { collectibleControllers } from "../controllers/collectibleController";

const collectibleRouter = Router();

collectibleRouter.get(
  "/:userId/listable",
  collectibleControllers.getListableCollectibles
);
collectibleRouter.get(
  "/:collectionId/collection/listable",
  collectibleControllers.getListableCollectiblesByCollectionId
);
collectibleRouter.get("/:id", collectibleControllers.getCollectibleById);

export = collectibleRouter;
