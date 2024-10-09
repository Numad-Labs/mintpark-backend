import { Router } from "express";
import { userController } from "../controllers/userController";
import { authenticateToken } from "../middlewares/authenticateToken";
const userRouter = Router();

userRouter.post("/generate-message", userController.generateMessageToSign);
userRouter.post("/login", userController.login);
userRouter.post("/refresh-token", userController.refreshToken);
userRouter.put("/:address", authenticateToken, userController.update);
userRouter.delete("/:address", authenticateToken, userController.delete);
userRouter.get("/:address", userController.getByAddress);

export = userRouter;
