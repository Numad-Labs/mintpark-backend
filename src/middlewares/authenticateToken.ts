import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../../custom";
import jwt from "jsonwebtoken";
import { config } from "../config/config";

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const jwtAuthSecret = config.JWT_ACCESS_SECRET;
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
