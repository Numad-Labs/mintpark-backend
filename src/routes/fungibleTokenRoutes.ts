import { fungibleTokenController } from "../controllers/fungibleTokenController";
import express from "express";
import { authenticateToken } from "../middlewares/authenticateToken";

const brc20Router = express.Router();

brc20Router.post(
  "/create-order",
  authenticateToken,
  fungibleTokenController.createOrder
);
brc20Router.post("/deploy", authenticateToken, fungibleTokenController.deploy);
export = brc20Router;
