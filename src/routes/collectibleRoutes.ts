import { Router } from "express";
import { collectibleControllers } from "../controllers/collectibleController";

const collectibleRouter = Router();

/* collectibleRouter.get(
  "/:userId/listable",
  collectibleControllers.getListableCollectibles
);
collectibleRouter.get(
  "/:collectionId/collection/listable",
  collectibleControllers.getListableCollectiblesByCollectionId
);
collectibleRouter.get("/:id", collectibleControllers.getCollectibleById);
collectibleRouter.get(
  "/:collectibleId/activity",
  collectibleControllers.getTokenActivity
);

collectibleRouter.put("/:id", collectibleControllers.update); */

export = collectibleRouter;
