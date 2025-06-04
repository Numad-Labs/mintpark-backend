import { Router } from "express";
import { collectibleTraitController } from "../controllers/collectibleTraitController";
import { authenticateToken } from "../middlewares/authenticateToken";

const collectibleTraitRouter = Router();

// Public routes
collectibleTraitRouter.get(
  "/:collectibleId/collectible",
  collectibleTraitController.getByCollectibleId
);

collectibleTraitRouter.post(
  "/batch",
  authenticateToken,
  collectibleTraitController.createBatchTraits
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
