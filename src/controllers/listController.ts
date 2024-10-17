import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../../custom";
import { CustomError } from "../exceptions/CustomError";

export const listController = {
  listCollectibleForSale: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {},
  generatePsbtHexToBuyListedCollectible: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {},
  buyListedCollectible: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {},
};
