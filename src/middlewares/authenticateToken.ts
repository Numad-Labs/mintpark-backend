import { NextFunction, Response } from "express";
import { AuthenticatedRequest, AuthenticatedUser } from "../../custom";
import { config } from "../config/config";
import { CustomError } from "../exceptions/CustomError";
import { verifyAccessToken } from "../utils/jwt";

export function authenticateToken() {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const jwtAuthSecret = config.JWT_ACCESS_SECRET;
      const authHeader = req.header("Authorization");
      const token = authHeader?.split(" ")[1];

      if (!jwtAuthSecret) {
        throw new CustomError("Server configuration error.", 500);
      }

      if (!token) {
        throw new CustomError("Authentication required.", 401);
      }

      const user: AuthenticatedUser = await verifyAccessToken(token);

      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}
