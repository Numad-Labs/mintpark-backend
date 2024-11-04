import { NextFunction, Response } from "express";
import { AuthenticatedRequest, AuthenticatedUser } from "../../custom";
import { config } from "../config/config";
import { verifyAccessToken } from "../utils/jwt";
import { CustomError } from "../exceptions/CustomError";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";

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

      const user = await verifyAccessToken(token, jwtAuthSecret);
      if (!user) {
        throw new CustomError("Invalid access token.", 401);
      }

      req.user = user;
      next();
    } catch (error) {
      await delay(2000);

      // Handle specific JWT errors
      if (error instanceof TokenExpiredError) {
        next(new CustomError("Access token has expired.", 401));
        return;
      }
      if (error instanceof JsonWebTokenError) {
        next(new CustomError("Invalid access token.", 401));
        return;
      }
      if (error instanceof CustomError) {
        next(error);
        return;
      }
      // Handle unexpected errors
      next(new CustomError("Authentication failed.", 500));
    }
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
