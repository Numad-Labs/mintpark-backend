import { NextFunction, Request, Response } from "express";
import { collectibleTraitRepository } from "../repositories/collectibleTraitRepository";

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
  }
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
