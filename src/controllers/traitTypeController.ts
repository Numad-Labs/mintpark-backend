import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../../custom";
import { CustomError } from "../exceptions/CustomError";
import { traitTypeRepository } from "../repositories/traitTypeRepository";

export const traitTypeController = {
  getTraitTypesByCollectionId: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectionId } = req.params;

      const result = await traitTypeRepository.getTraitTypesByCollectionId(
        collectionId
      );

      return res
        .status(200)
        .json({ success: true, data: { traitTypes: result } });
    } catch (e) {
      next(e);
    }
  }
};
