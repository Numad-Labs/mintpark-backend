import { Router } from "express";
import { collectibleTraitController } from "../controllers/collectibleTraitController";

const collectibleTraitRouter = Router();

collectibleTraitRouter.get(
  "/:collectibleId/collectible",
  collectibleTraitController.getByCollectibleId
);
/* collectibleTraitRouter.get(
  "/:collectionId/collection",
  collectibleTraitController.getByCollectionId
);
collectibleTraitRouter.get(
  "/:traitId/trait/:collectionId/collection",
  collectibleTraitController.getByTraitIdAndCollectionId
); */

export = collectibleTraitRouter;
