import { Router } from "express";
import { userController } from "../controllers/userController";
import { authenticateToken } from "../middlewares/authenticateToken";
const userRouter = Router();

userRouter.post("/generate-message", userController.generateMessageToSign);
userRouter.post("/login", userController.login);
userRouter.post("/refresh-token", userController.refreshToken);
userRouter.put("/:id", authenticateToken, userController.update);
userRouter.delete("/:id", authenticateToken, userController.delete);
userRouter.get("/:id", authenticateToken, userController.getById);

export = userRouter;
