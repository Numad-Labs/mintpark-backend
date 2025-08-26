import { NextFunction, Request, Response } from "express";
import { userRepository } from "../repositories/userRepository";
import { verifyRefreshToken } from "../utils/jwt";
import { userServices } from "../services/userServices";
import { CustomError } from "../exceptions/CustomError";
import { AuthenticatedRequest } from "../../custom";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { pointActivityRepository } from "@repositories/pointActivityRepository";

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

      const { user, tokens, userLayer } = await userServices.login(
        address,
        signedMessage,
        layerId,
        pubkey
      );

      return res.status(200).json({
        success: true,
        data: {
          user: user,
          userLayer,
          auth: tokens
        }
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
      if (!address || signedMessage === undefined || !layerId)
        throw new CustomError(
          "Please provide a wallet address, signedMessage and layerId.",
          400
        );
      if (!req.user?.id)
        throw new CustomError("Could not parse id from the token.", 401);

      const result = await userServices.linkAccount(
        req.user.id,
        address,
        signedMessage,
        layerId,
        pubkey
      );

      return res.status(200).json({
        success: true,
        data: result
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
      if (!address || signedMessage === undefined || !layerId)
        throw new CustomError(
          "Please provide a wallet address, signedMessage and layerId.",
          400
        );
      if (!req.user?.id)
        throw new CustomError("Could not parse id from the token.", 401);

      const result = await userServices.linkAccountToAnotherUser(
        req.user.id,
        address,
        signedMessage,
        layerId,
        pubkey
      );

      return res.status(200).json({
        success: true,
        data: result
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
        data: tokens
      });
    } catch (e) {
      if (e instanceof TokenExpiredError)
        return res.status(401).json({
          success: false,
          data: null,
          error: "Refresh token has expired."
        });

      if (e instanceof JsonWebTokenError)
        return res.status(401).json({
          success: false,
          data: null,
          error: "Invalid refresh token."
        });

      next(e);
    }
  },
  getByUserLayerId: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { userLayerId } = req.params;

    try {
      const user = await userRepository.getByUserLayerId(userLayerId);

      if (user?.id !== req.user?.id)
        throw new CustomError("You are not allowed to fetch this data.", 400);
      if (!user?.isActive)
        throw new CustomError("This account is deactivated.", 400);
      if (!user) return res.status(200).json({ success: true, data: null });

      return res.status(200).json({ success: true, data: { user } });
    } catch (e) {
      next(e);
    }
  },
  getPointActivityBalance: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { userLayerId } = req.params;

    try {
      const user = await userRepository.getByUserLayerId(userLayerId);
      if (!user) throw new CustomError("User not found", 400);

      if (req.user?.id !== user.id)
        throw new CustomError("You are not allowed to fetch this data.", 400);

      const balance = await pointActivityRepository.getBalanceByAddress(
        user.address
      );

      return res.status(200).json({
        success: true,
        data: {
          balance: Number(balance)
        }
      });
    } catch (e) {
      next(e);
    }
  },
  getAccountsByUserId: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { id } = req.params;

    try {
      if (req.user?.id !== id)
        throw new CustomError("You are not allowed to fetch this data.", 400);

      const accounts = await userRepository.getActiveAccountsByUserId(id);
      if (accounts.length)
        return res.status(200).json({ success: true, data: null });

      return res.status(200).json({
        success: true,
        data: {
          accounts
        }
      });
    } catch (e) {
      next(e);
    }
  }
  // hehe: async (req: Request, res: Response, next: NextFunction) => {
  //   const file = req.file as Express.Multer.File;

  //   const nftService = new NFTService(EVM_CONFIG.RPC_URL);

  //   const startingUnix = Date.now();
  //   const result = await nftService.uploadNFTMetadata(file, "TEST");
  //   const endingUnix = Date.now();
  //   console.log(`The upload process took ${endingUnix - startingUnix}ms`);

  //   res.send(result);
  // }
};
