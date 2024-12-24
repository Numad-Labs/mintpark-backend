import { Router } from "express";
import { collectibleControllers } from "../controllers/collectibleController";
import { authenticateToken } from "../middlewares/authenticateToken";
import { parseFiles } from "../middlewares/fileParser";
import { authorize } from "../middlewares/authorize";

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
collectibleRouter.get(
  "/:collectibleId/activity",
  collectibleControllers.getTokenActivity
);

// collectibleRouter.put("/:id", collectibleControllers.update);

collectibleRouter.post(
  "/inscription",
  authenticateToken,
  parseFiles("files", false),
  authorize("SUPER_ADMIN"),
  collectibleControllers.createInscriptionInBatch
);
collectibleRouter.post(
  "/recursive-inscription",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  collectibleControllers.createRecursiveInscriptionInBatch
);
collectibleRouter.post(
  "/ipfs",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  collectibleControllers.createIpfsNftInBatch
);

// collectibleRouter.post(
//   "/inscribe",
//   parseFiles("file", true),
//   collectibleControllers.inscribe
// );

export = collectibleRouter;
