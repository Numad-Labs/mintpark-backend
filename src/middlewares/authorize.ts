import { NextFunction, Response } from "express";
import { ROLES } from "../types/db/enums";
import { AuthenticatedRequest } from "../../custom";
import { CustomError } from "../exceptions/CustomError";

export function authorize(...roles: ROLES[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role)
      throw new CustomError(
        "Not authenticated or no role was provided for authorization.",
        401
      );

    if (!roles.includes(req.user.role)) {
      throw new CustomError("You are not allowed to do this action.", 401);
    }

    next();
  };
}
