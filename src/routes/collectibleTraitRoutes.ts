import { Router } from "express";
import { collectibleTraitController } from "../controllers/collectibleTraitController";
import { authenticateToken } from "../middlewares/authenticateToken";
import { apiKeyAuth } from "@middlewares/apiKeyAuth";

const collectibleTraitRouter = Router();

collectibleTraitRouter.post(
  "/",
  apiKeyAuth,
  collectibleTraitController.insertTraits
);

collectibleTraitRouter.post(
  "/batch",
  authenticateToken,
  collectibleTraitController.createBatchTraits
);

// Public routes
collectibleTraitRouter.get(
  "/:collectibleId/collectible",
  collectibleTraitController.getByCollectibleId
);

// Service-to-service APIs (internal)
collectibleTraitRouter.get(
  "/:collectibleId/collectible-with-inscriptions",
  apiKeyAuth,
  collectibleTraitController.getByCollectibleIdWithInscription
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
