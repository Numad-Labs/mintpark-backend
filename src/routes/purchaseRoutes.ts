import express from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { purchaseController } from "../controllers/purchaseController";
const purchaseRouter = express.Router();

purchaseRouter.post("/", authenticateToken, purchaseController.create);

purchaseRouter.post(
  "/:collectionId/generate",
  authenticateToken,
  purchaseController.generateTransaction
);

export = purchaseRouter;
