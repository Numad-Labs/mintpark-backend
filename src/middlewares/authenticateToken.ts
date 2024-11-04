import { NextFunction, Response } from "express";
import { AuthenticatedRequest, AuthenticatedUser } from "../../custom";
import { config } from "../config/config";
import { verifyAccessToken } from "../utils/jwt";
import { CustomError } from "../exceptions/CustomError";

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

      const user = verifyAccessToken(token);
      if (!user) throw new CustomError("Invalid access token.", 401);

      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}
