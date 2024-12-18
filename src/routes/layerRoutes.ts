import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { layerController } from "../controllers/layerController";

const layerRouter = Router();

layerRouter.get("/:id", layerController.getById);
layerRouter.get("/", layerController.getAll);
// layerRouter.get("/:layerId/fee-rates", layerController.getFeeRates);
// layerRouter.post("/estimate-fee", layerController.getEstimatedFee);

export = layerRouter;
