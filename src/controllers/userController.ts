import { NextFunction, Request, Response } from "express";
import { userRepository } from "../repositories/userRepository";
import { Updateable } from "kysely";
import { User } from "../types/db/types";
import { verifyRefreshToken } from "../utils/jwt";
import { userServices } from "../services/userServices";
import { CustomError } from "../exceptions/CustomError";
import { AuthenticatedRequest } from "../../custom";
import { hideSensitiveData } from "../libs/hideDataHelper";

export const userController = {
  generateMessageToSign: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const { address } = req.body;

    try {
      if (!address)
        throw new CustomError("Please provide a wallet address.", 400);

      const message = await userServices.generateMessageToSign(address);

      return res.status(200).json({ success: true, data: { message } });
    } catch (e) {
      next(e);
    }
  },
  login: async (req: Request, res: Response, next: NextFunction) => {
    const { address, signedMessage, pubkey, layerId } = req.body;

    try {
      if (!address || !signedMessage || !layerId)
        throw new CustomError(
          "Please provide a wallet address, signedMessage and layerId.",
          400
        );

      const { user, tokens } = await userServices.login(
        address,
        pubkey,
        signedMessage,
        layerId
      );

      return res.status(200).json({
        success: true,
        data: {
          user: user,
          auth: tokens,
        },
      });
    } catch (e) {
      next(e);
    }
  },
  refreshToken: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.body.refreshToken;

      if (!refreshToken)
        throw new CustomError(`Please provide a refresh token.`, 400);

      const tokens = await verifyRefreshToken(refreshToken);

      return res.status(200).json({
        success: true,
        data: tokens,
      });
    } catch (e) {
      next(e);
    }
  },
  update: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { id } = req.params;
    const data: Updateable<User> = { ...req.body };

    try {
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);

      const user = await userServices.update(id, data, req.user.id);

      return res.status(200).json({ success: true, data: user });
    } catch (e) {
      next(e);
    }
  },
  delete: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { id } = req.params;

    try {
      if (!req.user?.id)
        throw new CustomError("Could not retrieve id from the token.", 400);

      const user = await userServices.delete(id, req.user.id);

      return res.status(200).json({ success: true, data: user });
    } catch (e) {
      next(e);
    }
  },
  getById: async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    try {
      const user = await userRepository.getById(id);
      if (!user) return res.status(200).json({ success: true, data: null });

      const sanitizedUser = await hideSensitiveData(user, ["pubkey", "xpub"]);

      return res.status(200).json({ success: true, data: sanitizedUser });
    } catch (e) {
      next(e);
    }
  },
  getByAddress: async (req: Request, res: Response, next: NextFunction) => {
    const { address } = req.body;

    try {
      const user = await userRepository.getByAddress(address);
      if (!user) return res.status(200).json({ success: true, data: null });

      const sanitizedUser = await hideSensitiveData(user, ["pubkey", "xpub"]);

      return res.status(200).json({ success: true, data: sanitizedUser });
    } catch (e) {
      next(e);
    }
  },
};
