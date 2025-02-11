import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { traitValueController } from "../controllers/traitValueController";
import { parseFiles } from "../middlewares/fileParser";

const traitValueRouter = Router();

traitValueRouter.post(
  "/",
  authenticateToken,
  parseFiles("files", false),
  traitValueController.create
);
traitValueRouter.get(
  "/:traitTypeId/trait-type",
  traitValueController.getTraitValuesByTraitTypeId
);

export = traitValueRouter;
