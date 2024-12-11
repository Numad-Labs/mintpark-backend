import { Router } from "express";
import { collectibleControllers } from "../controllers/collectibleController";
import { authenticateToken } from "../middlewares/authenticateToken";
import { parseFiles } from "../middlewares/fileParser";

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

collectibleRouter.post(
  "/inscription",
  authenticateToken,
  parseFiles("files", false),
  collectibleControllers.createInscriptionInBatch
);
collectibleRouter.post(
  "/recursive-inscription",
  authenticateToken,
  collectibleControllers.createRecursiveInscriptionInBatch
);
collectibleRouter.post(
  "/ipfs",
  authenticateToken,
  collectibleControllers.createIpfsNftInBatch
);

export = collectibleRouter;
