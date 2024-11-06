import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { collectionController } from "../controllers/collectionController";
import { parseFiles } from "../middlewares/fileParser";
import { authorize } from "../middlewares/authorize";

const collectionRouter = Router();

collectionRouter.post(
  "/",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  parseFiles("logo", true),
  collectionController.create
);

collectionRouter.post(
  "/list-evm",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  collectionController.listForEvm
);

collectionRouter.post(
  "/:collectionId/launch",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  parseFiles("files", false),
  collectionController.launchCollection
);

collectionRouter.get("/listed", collectionController.getListedCollections);
collectionRouter.get("/:id", collectionController.getById);

collectionRouter.put(
  "/:id",
  authenticateToken,
  parseFiles("logo", true),
  collectionController.update
);

export = collectionRouter;
