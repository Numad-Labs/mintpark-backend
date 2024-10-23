// controllers/launchpadController.ts
import { NextFunction, Request, Response } from "express";
import MarketplaceService from "../services/marketplaceService";
import { EVM_CONFIG } from "../evm-config";
import LaunchpadService from "../services/launchpadService";
import { serializeBigInt } from "../utils";

interface LaunchConfig {
  collectionAddress: string;
  startTime: number;
  endTime: number;
  price: string;
  isWhitelisted: boolean;
}

const launchPadService = new LaunchpadService(
  EVM_CONFIG.RPC_URL,
  new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS)
);

export const createLaunchpadListing = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { launchConfig, ownerAddress, totalSupply } = req.body;

    // Validate input
    if (!launchConfig || !ownerAddress || !totalSupply) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required parameters: launchConfig, ownerAddress, or totalSupply",
      });
    }

    // Validate launchConfig fields
    const requiredFields = [
      "collectionAddress",
      "startTime",
      "endTime",
      "price",
      "isWhitelisted",
    ];
    for (const field of requiredFields) {
      if (!(field in launchConfig)) {
        return res.status(400).json({
          success: false,
          error: `Missing required field in launchConfig: ${field}`,
        });
      }
    }

    const unsignedTx = await launchPadService.createLaunchpadListingWithAssets(
      launchConfig,
      ownerAddress,
      totalSupply
    );

    // Serialize BigInt values before sending the response
    const serializedTx = serializeBigInt(unsignedTx);

    res.json({ success: true, unsignedTransaction: serializedTx });
  } catch (e) {
    next(e);
  }
};
