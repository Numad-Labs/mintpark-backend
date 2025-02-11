import { Router } from "express";
import { traitTypeController } from "../controllers/traitTypeController";

const traitTypeRouter = Router();

traitTypeRouter.get(
  "/:collectionId/collection",
  traitTypeController.getTraitTypesByCollectionId
);

export default traitTypeRouter;
