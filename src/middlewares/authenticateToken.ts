import { NextFunction, Response } from "express";
import { AuthenticatedRequest, AuthenticatedUser } from "../../custom";
import { config } from "../config/config";
import { CustomError } from "../exceptions/CustomError";
import { verifyAccessToken } from "../utils/jwt";
import jwt from "jsonwebtoken";

// export function authenticateToken() {
//   return async (
//     req: AuthenticatedRequest,
//     res: Response,
//     next: NextFunction
//   ) => {
//     try {
//       const jwtAuthSecret = config.JWT_ACCESS_SECRET;
//       const authHeader = req.header("Authorization");
//       const token = authHeader?.split(" ")[1];

//       if (!jwtAuthSecret) {
//         throw new CustomError("Server configuration error.", 500);
//       }

//       if (!token) {
//         throw new CustomError("Authentication required.", 401);
//       }

//       const user: AuthenticatedUser = await verifyAccessToken(token);

//       req.user = user;
//       next();
//     } catch (error) {
//       next(error);
//     }
//   };
// }

export const authenticateToken = () => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        throw new CustomError("No authorization header", 401);
      }

      // Check for Bearer token format
      const [bearer, token] = authHeader.split(" ");

      if (bearer !== "Bearer" || !token) {
        throw new CustomError("Invalid token format", 401);
      }

      try {
        // Verify the token
        const payload = jwt.verify(
          token,
          config.JWT_ACCESS_SECRET
        ) as AuthenticatedUser;
        req.user = payload;
        next();
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
          throw new CustomError("Token expired", 401);
        } else if (err instanceof jwt.JsonWebTokenError) {
          throw new CustomError("Invalid token", 401);
        }
        throw err;
      }
    } catch (error) {
      if (error instanceof CustomError)
        return res.status(error.errorCode).json({
          success: false,
          error: error.message,
        });

      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };
};
