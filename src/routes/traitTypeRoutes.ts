import { Router } from "express";
import { traitTypeController } from "../controllers/traitTypeController";
import { authenticateToken } from "@middlewares/authenticateToken";

const traitTypeRouter = Router();

traitTypeRouter.post(
  "/",
  authenticateToken,
  traitTypeController.createTraitTypes
);

traitTypeRouter.get(
  "/:collectionId/collection",
  traitTypeController.getTraitTypesByCollectionId
);

export default traitTypeRouter;
