import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../../custom";
import { CustomError } from "../exceptions/CustomError";
import { traitValueServices } from "../services/traitValueServices";

export interface traitValueParams {
  type: string;
  value: string;
  zIndex: number;
  file?: Express.Multer.File;
  fileKey?: string;
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

      const { collectionId, userLayerId } = req.body;
      const files: Express.Multer.File[] = req.files as Express.Multer.File[];

      const parsedJsonData = JSON.parse(req.body.data);
      const data: traitValueParams[] = Array.isArray(parsedJsonData)
        ? parsedJsonData
        : parsedJsonData
        ? [parsedJsonData]
        : [];

      if (data.length === 0)
        throw new CustomError("Please provide the data.", 400);
      if (data.length > 10)
        throw new CustomError(
          "You cannot provide more than 10 elements of data.",
          400
        );
      if (files.length > 10)
        throw new CustomError("You cannot provide more than 10 files.", 400);
      if (files.length !== data.length)
        throw new CustomError("Differing number of names & files found.", 400);

      const result = await traitValueServices.create(
        req.user.id,
        userLayerId,
        collectionId,
        data,
        files
      );

      return res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  },
};
