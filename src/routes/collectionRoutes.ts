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
  "/phase",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  collectionController.addPhase
);

collectionRouter.put(
  "/phase",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  collectionController.updatePhase
);

// collectionRouter.post(
//   "/list-evm",
//   authenticateToken,
//   authorize("SUPER_ADMIN"),
//   collectionController.listForEvm
// );

collectionRouter.get("/listed", collectionController.getListedCollections);
collectionRouter.get("/:id", collectionController.getById);

// collectionRouter.put(
//   "/:id",
//   authenticateToken,
//   parseFiles("logo", true),
//   collectionController.update
// );

export = collectionRouter;
