import express from "express";
import { collectionController } from "../controllers/collectionController";
import { authenticateToken } from "../middlewares/authenticateToken";
import { parseFiles } from "../middlewares/fileParser";
const collectionRouter = express.Router();

collectionRouter.get("/", collectionController.get);
collectionRouter.post(
  "/",
  authenticateToken,
  parseFiles("logo", true),
  collectionController.create
);
collectionRouter.post(
  "/:collectionId",
  authenticateToken,
  parseFiles("images", false),
  collectionController.addToCollection
);
collectionRouter.post(
  "/:collectionId/mint",
  authenticateToken,
  collectionController.mintCollection
);
collectionRouter.get("/:id", collectionController.getById);
collectionRouter.get("/", collectionController.getByLayerType);

export = collectionRouter;
