import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { orderController } from "../controllers/orderController";
import { parseFiles } from "../middlewares/fileParser";

const orderRouter = Router();

orderRouter.post(
  "/",
  authenticateToken,
  parseFiles("files", false),
  orderController.create
);

export = orderRouter;
