import { Router } from "express";
import { userController } from "../controllers/userController";
import { authenticateToken } from "../middlewares/authenticateToken";
import { parseFiles } from "../middlewares/fileParser";
const userRouter = Router();

userRouter.post("/generate-message", userController.generateMessageToSign);
userRouter.post("/login", userController.login);
userRouter.post("/link-account", authenticateToken, userController.linkAccount);
userRouter.post(
  "/link-account-to-another-user",
  authenticateToken,
  userController.linkAccountToAnotherUser
);
userRouter.post("/refresh-token", userController.refreshToken);

userRouter.get(
  "/:userLayerId/userLayer",
  authenticateToken,
  userController.getByUserLayerId
);
userRouter.get(
  "/:userLayerId/point-activity-balance",
  authenticateToken,
  userController.getPointActivityBalance
);
userRouter.get(
  "/:id/accounts",
  authenticateToken,
  userController.getAccountsByUserId
);

// userRouter.post("/test", parseFiles("hehe", true), userController.hehe);

export = userRouter;
