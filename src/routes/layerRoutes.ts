import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { layerController } from "../controllers/layerController";

const layerRouter = Router();

layerRouter.post("/", layerController.create);
layerRouter.put("/:id", layerController.update);
layerRouter.delete("/:id", layerController.delete);
layerRouter.get("/:id", layerController.getById);
layerRouter.get("/", layerController.getAll);
layerRouter.get("/name/:name", layerController.getByName);

export = layerRouter;
