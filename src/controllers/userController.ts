import { NextFunction, Request, Response } from "express";
import { userRepository } from "../repositories/userRepository";
import { Updateable } from "kysely";
import { User } from "../types/db/types";
import { verifyRefreshToken } from "../utils/jwt";
import { userServices } from "../services/userServices";
import { CustomError } from "../exceptions/CustomError";
import { AuthenticatedRequest } from "../../custom";
import { hideSensitiveData } from "../libs/hideDataHelper";
import logger from "../config/winston";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";

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
  linkAccount: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { address, signedMessage, pubkey, layerId } = req.body;

    try {
      if (!address || !signedMessage || !layerId)
        throw new CustomError(
          "Please provide a wallet address, signedMessage and layerId.",
          400
        );
      if (!req.user?.id)
        throw new CustomError("Could not parse id from the token.", 401);

      const result = await userServices.linkAccount(
        req.user.id,
        address,
        pubkey,
        signedMessage,
        layerId
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (e) {
      next(e);
    }
  },
  linkAccountToAnotherUser: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { address, signedMessage, pubkey, layerId } = req.body;

    try {
      if (!address || !signedMessage || !layerId)
        throw new CustomError(
          "Please provide a wallet address, signedMessage and layerId.",
          400
        );
      if (!req.user?.id)
        throw new CustomError("Could not parse id from the token.", 401);

      const result = await userServices.linkAccountToAnotherUser(
        req.user.id,
        address,
        pubkey,
        signedMessage,
        layerId
      );

      return res.status(200).json({
        success: true,
        data: result,
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
      if (!tokens) throw new CustomError(`Invalid token.`, 400);

      return res.status(200).json({
        success: true,
        data: tokens,
      });
    } catch (e) {
      if (e instanceof TokenExpiredError)
        return res.status(401).json({
          success: false,
          data: null,
          error: "Refresh token has expired.",
        });

      if (e instanceof JsonWebTokenError)
        return res.status(401).json({
          success: false,
          data: null,
          error: "Invalid refresh token.",
        });

      next(e);
    }
  },
  getById: async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { layerId } = req.query;

    try {
      if (!layerId) throw new CustomError("Please provide a layerId.", 400);

      const user = await userRepository.getByIdAndLayerId(
        id,
        layerId.toString()
      );
      if (!user) return res.status(200).json({ success: true, data: null });

      return res.status(200).json({ success: true, data: user });
    } catch (e) {
      next(e);
    }
  },
};
