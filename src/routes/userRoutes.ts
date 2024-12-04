import { Router } from "express";
import { userController } from "../controllers/userController";
import { authenticateToken } from "../middlewares/authenticateToken";
const userRouter = Router();

userRouter.post("/generate-message", userController.generateMessageToSign);
userRouter.post("/login", userController.login);
userRouter.post("/link-account", userController.linkAccount);
userRouter.post(
  "/link-account-to-another-user",
  userController.linkAccountToAnotherUser
);
userRouter.post("/refresh-token", userController.refreshToken);
userRouter.get("/:id", userController.getById);

export = userRouter;
