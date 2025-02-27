import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { traitValueController } from "../controllers/traitValueController";
import { parseFiles } from "../middlewares/fileParser";
import { authorize } from "../middlewares/authorize";

const traitValueRouter = Router();

traitValueRouter.post(
  "/",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  parseFiles("files", false),
  traitValueController.create
);
traitValueRouter.get(
  "/:traitTypeId/trait-type",
  traitValueController.getTraitValuesByTraitTypeId
);

export = traitValueRouter;
