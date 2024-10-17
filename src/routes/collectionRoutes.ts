import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { collectionController } from "../controllers/collectionController";
import { parseFiles } from "../middlewares/fileParser";

const collectionRouter = Router();

collectionRouter.post(
  "/",
  authenticateToken,
  parseFiles("logo", true),
  collectionController.create
);

collectionRouter.get("/:collectionId", collectionController.getById);

collectionRouter.get("/", collectionController.getAllLaunchedCollections);

export = collectionRouter;
