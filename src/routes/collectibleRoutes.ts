import express from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { collectibleController } from "../controllers/collectibleController";
import { parseFiles } from "../middlewares/fileParser";
const collectibleRouter = express.Router();

collectibleRouter.post(
  "/",
  authenticateToken,
  parseFiles("images", false),
  collectibleController.create
);
collectibleRouter.post(
  "/create-order",
  authenticateToken,
  parseFiles("file", true),
  collectibleController.createOrder
);
collectibleRouter.post("/mint", authenticateToken, collectibleController.mint);

collectibleRouter.get("/:id", collectibleController.getById);
collectibleRouter.get(
  "/:collectionId/collections",
  collectibleController.getByCollectionId
);

export = collectibleRouter;
