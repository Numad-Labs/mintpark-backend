import { NextFunction, Response } from "express";
import { AuthenticatedRequest, AuthenticatedUser } from "../../custom";
import { config } from "../config/config";
import { verifyAccessToken } from "../utils/jwt";
import { CustomError } from "../exceptions/CustomError";
import { JsonWebTokenError, Secret, TokenExpiredError } from "jsonwebtoken";
import jwt from "jsonwebtoken";

// export async function authenticateToken(
//   req: AuthenticatedRequest,
//   res: Response,
//   next: NextFunction
// ) {
//   try {
//     const jwtAuthSecret = config.JWT_ACCESS_SECRET;
//     const authHeader = req.header("Authorization");
//     const token = authHeader?.split(" ")[1];

//     if (!jwtAuthSecret) {
//       // throw new CustomError("Server configuration error.", 500);
//       return res.status(500).json({
//         success: false,
//         data: null,
//         error: "Server configuration error.",
//       });
//     }

//     if (!token) {
//       // throw new CustomError("Authentication required.", 401);
//       return res.status(401).json({
//         success: false,
//         data: null,
//         error: "Authentication required.",
//       });
//     }

//     console.log(`verifyAccessToken started at: ${new Date()}`);
//     const user = await verifyAccessToken(token, jwtAuthSecret);
//     console.log(`verifyAccessToken ended at: ${new Date()}`);
//     if (!user) {
//       // throw new CustomError("Invalid access token.", 401);
//       return res
//         .status(401)
//         .json({ success: false, data: null, error: "Invalid access token." });
//     }

//     req.user = user;
//     next();
//   } catch (error) {
//     // Handle specific JWT errors
//     if (error instanceof TokenExpiredError) {
//       // next(new CustomError("Access token has expired.", 401));
//       // return;

//       return res.status(401).json({
//         success: false,
//         data: null,
//         error: "Access token has expired.",
//       });
//     }

//     if (error instanceof JsonWebTokenError) {
//       // next(new CustomError("Invalid access token.", 401));
//       // return;

//       return res
//         .status(401)
//         .json({ success: false, data: null, error: "Invalid access token." });
//     }

//     return res
//       .status(500)
//       .json({ success: false, data: null, error: "Authentication failed." });
//     // if (error instanceof CustomError) {
//     //   next(error);
//     //   return;
//     // }
//     // // Handle unexpected errors
//     // next(new CustomError("Authentication failed.", 500));
//   }
// }

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const jwtAuthSecret: Secret | undefined = config.JWT_ACCESS_SECRET;

  const token = req.header("Authorization")?.split(" ")[1];

  if (!jwtAuthSecret) {
    throw new Error("jwtAuthSecret is not defined.");
  }
  if (!token)
    return res.status(401).json({ message: "Authentication required" });

  jwt.verify(token, jwtAuthSecret, (err, user: any) => {
    if (err) return res.status(401).json({ message: `Invalid token ${err}` });

    req.user = user;
    next();
  });
};
