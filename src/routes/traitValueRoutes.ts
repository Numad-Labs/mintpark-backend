import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { traitValueController } from "../controllers/traitValueController";

const traitValueRouter = Router();

traitValueRouter.post("/", authenticateToken, traitValueController.create);

export = traitValueRouter;
