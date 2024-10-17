import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../../custom";
import { CustomError } from "../exceptions/CustomError";
import { collectibleServices } from "../services/collectibleServices";

export const collectibleContollers = {
  getListableCollectibles: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;

      if (!userId) throw new CustomError("userId not found.", 400);

      const listableCollectibles =
        await collectibleServices.getListableCollectibles(userId);

      return res
        .status(200)
        .json({ success: true, data: listableCollectibles });
    } catch (e) {}
  },
};
