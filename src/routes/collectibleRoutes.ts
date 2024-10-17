import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { collectionController } from "../controllers/collectionController";
import { parseFiles } from "../middlewares/fileParser";
import { collectibleContollers } from "../controllers/collectibleController";

const collectibleRouter = Router();

collectibleRouter.get(
  "/:userId/listable",
  authenticateToken,
  collectibleContollers.getListableCollectibles
);

export = collectibleRouter;
