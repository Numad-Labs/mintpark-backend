import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../src/exceptions/CustomError";
// import { CustomError } from "../exceptions/CustomError";
import { userServices } from "../services/userServices";
// import * as userServices from "../services/userServices";

export const userController = {
  generateMessageToSign: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const { address } = req.body;
    try {
      //todo custom error bolgoh
      if (!address) {
        return res.status(400).json({
          success: false,
          error: "Please provide a wallet address",
        });
      }
      const message = await userServices.generateMessageToSign(address);
      return res.status(200).json({ success: true, data: { message } });
    } catch (e) {
      next(e);
    }
  },

  login: async (req: Request, res: Response, next: NextFunction) => {
    const { address, signedMessage, layerId } = req.body;
    try {
      //todo custom error bolgoh

      if (!address || !signedMessage) {
        return res.status(400).json({
          success: false,
          error: "Please provide a wallet address, signed message.",
        });
      }
      const { user, tokens } = await userServices.login(
        address,
        signedMessage,
        layerId
        // xpub
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
};
