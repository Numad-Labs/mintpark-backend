import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../../custom";
import { CustomError } from "../exceptions/CustomError";
import { traitValueServices } from "../services/traitValueServices";

export interface traitValueParams {
  type: string;
  value: string;
  zIndex: number;
  file: Express.Multer.File;
  collectionId: string;
}

export const traitValueController = {
  create: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.id)
        throw new CustomError("Could not parse the id from the token.", 400);

      const data: traitValueParams = {
        type: req.body.type,
        value: req.body.value,
        zIndex: req.body.zIndex,
        file: req.file as Express.Multer.File,
        collectionId: req.body.collectionId,
      };
      const result = await traitValueServices.create(req.user.id, data);

      return res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  },
};
