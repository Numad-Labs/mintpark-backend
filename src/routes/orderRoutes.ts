import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { orderController } from "../controllers/orderController";

const orderRouter = Router();

export = orderRouter;
