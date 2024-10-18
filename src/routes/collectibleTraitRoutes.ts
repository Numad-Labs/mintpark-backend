import { Router } from "express";
import { collectibleControllers } from "../controllers/collectibleController";
import { collectibleTraitController } from "../controllers/collectibleTraitController";

const collectibleTraitRouter = Router();

collectibleTraitRouter.get(
  "/:collectibleId/collectible",
  collectibleTraitController.getByCollectibleId
);

export = collectibleTraitRouter;
