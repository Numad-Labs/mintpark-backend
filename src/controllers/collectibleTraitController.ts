import { NextFunction, Request, Response } from "express";
import { collectibleTraitRepository } from "../repositories/collectibleTraitRepository";
import { collectibleTraitServices } from "../services/collectibleTraitServices";
import { z } from "zod";
import { AuthenticatedRequest } from "../../custom";

// Validation schema for createBatchTraits request
const createBatchTraitsSchema = z.object({
  collectionId: z.string(),
  batchData: z.array(z.object({
    collectibleId: z.string(),
    traits: z.array(z.object({
      trait_type: z.string(),
      value: z.string()
    }))
  }))
});

export const collectibleTraitController = {
  getByCollectibleId: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectibleId } = req.params;
      const traits = await collectibleTraitRepository.getByCollectibleId(
        collectibleId
      );
      return res.status(200).json({ success: true, data: { traits } });
    } catch (e) {
      next(e);
    }
  },

  createBatchTraits: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const validatedData = createBatchTraitsSchema.parse(req.body);
      const { collectionId, batchData } = validatedData;

      const result = await collectibleTraitServices.createBatchTraits(
        collectionId,
        batchData,
        req.user?.id
      );

      return res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid request data",
          details: error.errors
        });
      }
      next(error);
    }
  },
  // getByCollectionId: async (
  //   req: Request,
  //   res: Response,
  //   next: NextFunction
  // ) => {
  //   try {
  //     const { collectionId } = req.params;
  //     const traits = await collectibleTraitRepository.getByCollectionId(
  //       collectionId
  //     );
  //     return res.status(200).json({ success: true, data: traits });
  //   } catch (e) {
  //     next(e);
  //   }
  // },
  // getByTraitIdAndCollectionId: async (
  //   req: Request,
  //   res: Response,
  //   next: NextFunction
  // ) => {
  //   try {
  //     const { traitId, collectionId } = req.params;
  //     const traits =
  //       await collectibleTraitRepository.getByTraitIAndCollectionId(
  //         traitId,
  //         collectionId
  //       );
  //     return res.status(200).json({ success: true, data: traits });
  //   } catch (e) {
  //     next(e);
  //   }
  // },

};
