import { NextFunction, Request, Response } from "express";
import { userRepository } from "../repositories/userRepository";
import { Updateable } from "kysely";
import { User } from "../types/db/types";
import { verifyRefreshToken } from "../utils/jwt";
import { userServices } from "../services/userServices";
import { CustomError } from "../exceptions/CustomError";
import { AuthenticatedRequest } from "../../custom";

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
    const { address, signedMessage, xpub } = req.body;

    try {
      if (!address || !signedMessage || !xpub)
        throw new CustomError(
          "Please provide a wallet address, signed message and xpub.",
          400
        );

      const { user, tokens } = await userServices.login(
        address,
        xpub,
        signedMessage
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
  refreshToken: async (req: Request, res: Response) => {
    const refreshToken = req.body.refreshToken;

    if (!refreshToken)
      throw new CustomError(`Please provide a refresh token.`, 400);

    const tokens = verifyRefreshToken(refreshToken);

    return res.status(200).json({
      success: true,
      data: tokens,
    });
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

      return res.status(200).json({ success: true, data: user });
    } catch (e) {
      next(e);
    }
  },
};
