import { NextFunction, Response } from "express";
import { ROLES } from "../types/db/enums";
import { AuthenticatedRequest } from "../../custom";
import { CustomError } from "../exceptions/CustomError";
import logger from "../config/winston";

export function authorize(...roles: ROLES[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role)
      return res.status(401).json({
        success: false,
        data: null,
        message: "Not authenticated or no role was provided for authorization.",
      });

    if (!roles.includes(req.user.role))
      return res.status(401).json({
        success: false,
        data: null,
        message: "You are not allowed to do this action.",
      });

    next();
  };
}
