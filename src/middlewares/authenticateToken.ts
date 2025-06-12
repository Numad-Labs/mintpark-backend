import { NextFunction, Response } from "express";
import { AuthenticatedRequest, AuthenticatedUser } from "../../custom";
import { config } from "../config/config";
import { verifyAccessToken } from "../utils/jwt";
import { JsonWebTokenError, Secret, TokenExpiredError } from "jsonwebtoken";
import { CustomError } from "../exceptions/CustomError";

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const jwtAuthSecret = config.JWT_ACCESS_SECRET;
    const authHeader = req.header("Authorization");
    const token = authHeader?.split(" ")[1];

    if (!jwtAuthSecret)
      return res.status(500).json({
        success: false,
        data: null,
        error: "Server configuration error."
      });

    if (!token)
      return res.status(401).json({
        success: false,
        data: null,
        error: "Authentication required."
      });

    const user = await verifyAccessToken(token, jwtAuthSecret);

    if (!user)
      return res
        .status(401)
        .json({ success: false, data: null, error: "Invalid access token." });

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError)
      return res.status(401).json({
        success: false,
        data: null,
        error: "Access token has expired."
      });

    if (error instanceof JsonWebTokenError)
      return res
        .status(401)
        .json({ success: false, data: null, error: "Invalid access token." });

    return res
      .status(500)
      .json({ success: false, data: null, error: "Authentication failed." });
  }
}
export function verifyMarketplaceSyncSecret(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const providedSecret = req.header("x-marketplace-sync-secret");

  if (
    !providedSecret ||
    providedSecret !== process.env.MARKETPLACE_SYNC_SECRET
  ) {
    return res
      .status(403)
      .json({ success: false, message: "Unauthorized sync attempt" });
  }

  next();
}

export function optionalAuth() {
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

      if (token) {
        const user = await verifyAccessToken(token, jwtAuthSecret);
        if (!user)
          return res.status(401).json({
            success: false,
            data: null,
            error: "Invalid access token."
          });

        req.user = user;
      }

      next();
    } catch (error) {
      next();
    }
  };
}
