import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { traitValueController } from "../controllers/traitValueController";
import { parseFiles } from "../middlewares/fileParser";
import { authorize } from "../middlewares/authorize";
import { apiKeyAuth } from "../middlewares/apiKeyAuth";

const traitValueRouter = Router();

// Service-to-service APIs (internal)
traitValueRouter.get(
  "/service/:collectionId",
  apiKeyAuth,
  traitValueController.getRandomTraitValueByCollectionIdForService
);
traitValueRouter.patch(
  "/service/update-inscription",
  apiKeyAuth,
  traitValueController.updateTraitValueInscription
);
traitValueRouter.get(
  "/service/:collectionId/not-done-count",
  apiKeyAuth,
  traitValueController.getNotDoneTraitValueCountByCollectionId
);

// Public/creator APIs
traitValueRouter.post(
  "/",
  authenticateToken,
  parseFiles("files", false),
  traitValueController.createTraitValue
);
traitValueRouter.get(
  "/:traitTypeId/trait-type",
  traitValueController.getTraitValuesByTraitTypeId
);

export = traitValueRouter;
