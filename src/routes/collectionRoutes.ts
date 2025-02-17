import { Router } from "express";
import { authenticateToken } from "../middlewares/authenticateToken";
import { collectionController } from "../controllers/collectionController";
import { parseFiles } from "../middlewares/fileParser";
import { authorize } from "../middlewares/authorize";

import { Request, Response, NextFunction } from "express";
import { CustomError } from "../exceptions/CustomError";
import { EVM_CONFIG } from "../blockchain/evm/evm-config";
import { userRepository } from "../repositories/userRepository";
import { collectionRepository } from "../repositories/collectionRepository";
import { db } from "../utils/db";
import { AuthenticatedRequest } from "../../custom";
import { layerRepository } from "../repositories/layerRepository";
import { DirectMintNFTService } from "../blockchain/evm/services/nftService/directNFTService";
import { serializeBigInt } from "../blockchain/evm/utils";
const collectionRouter = Router();

collectionRouter.post(
  "/",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  parseFiles("logo", true),
  collectionController.create
);

// collectionRouter.post(
//   "/list-evm",
//   authenticateToken,
//   authorize("SUPER_ADMIN"),
//   collectionController.listForEvm
// );

collectionRouter.get("/listed", collectionController.getListedCollections);
collectionRouter.get("/:id", collectionController.getById);

// collectionRouter.put(
//   "/:id",
//   authenticateToken,
//   parseFiles("logo", true),
//   collectionController.update
// );
interface SetPhaseRequest {
  collectionId: string;
  phaseType: "NOT_STARTED" | "WHITELIST" | "PUBLIC";
  price: string; // in ETH
  maxSupply: number;
  maxPerWallet: number;
  durationInHours: number; // How long the phase should last
  merkleRoot?: string; // Optional for whitelist
}

// Map phase types to enum values in contract
const PHASE_TYPE_MAP = {
  NOT_STARTED: 0,
  WHITELIST: 1,
  PUBLIC: 2
};

collectionRouter.post(
  "/set-phase",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const {
        collectionId,
        phaseType,
        price,
        maxSupply,
        maxPerWallet,
        durationInHours,
        merkleRoot = "0x0000000000000000000000000000000000000000000000000000000000000000",
        userLayerId
      } = req.body;

      // Validate request
      if (!collectionId)
        throw new CustomError("Collection ID is required", 400);
      if (!phaseType || !PHASE_TYPE_MAP.hasOwnProperty(phaseType)) {
        throw new CustomError("Invalid phase type", 400);
      }
      if (!price || isNaN(Number(price)))
        throw new CustomError("Invalid price", 400);
      if (!maxSupply || maxSupply <= 0)
        throw new CustomError("Invalid max supply", 400);
      if (!maxPerWallet || maxPerWallet <= 0)
        throw new CustomError("Invalid max per wallet", 400);
      if (!durationInHours || durationInHours <= 0)
        throw new CustomError("Invalid duration", 400);

      // Get collection and validate
      const collection = await collectionRepository.getById(db, collectionId);
      if (!collection) throw new CustomError("Collection not found", 404);
      if (!collection.contractAddress)
        throw new CustomError("Collection has no contract address", 400);
      if (!req.user) throw new CustomError("Unauthorized", 401);

      // Get user (admin) making the request
      const user = await userRepository.getById(req.user.id);

      const issuer = await userRepository.getByUserLayerId(userLayerId);
      if (!issuer) throw new CustomError("User not found", 404);

      // userRepository.
      if (!user) throw new CustomError("Unauthorized", 401);
      // if (!user?.chainId)
      //   throw new CustomError("User chain configuration not found", 400);

      const layer = await layerRepository.getById(collection.layerId);
      if (!layer || !layer.chainId)
        throw new CustomError("Layer configuration not found", 400);

      const chainConfig = EVM_CONFIG.CHAINS[layer.chainId];
      const nftService = new DirectMintNFTService(chainConfig.RPC_URL);

      // Calculate timestamps
      const startTime = Math.floor(Date.now() / 1000); // Start now
      const endTime = startTime + durationInHours * 3600; // Convert hours to seconds

      // Get unsigned transaction
      const unsignedTx = await nftService.getUnsignedSetPhaseTransaction(
        collection.contractAddress,
        BigInt(2),
        price,
        startTime,
        endTime,
        maxSupply,
        maxPerWallet,
        merkleRoot,
        issuer.address
      );

      // Serialize transaction (handle BigInt values)
      const serializedTx = serializeBigInt(unsignedTx);

      return res.status(200).json({
        success: true,
        data: {
          transaction: serializedTx,
          startTime,
          endTime,
          collectionAddress: collection.contractAddress
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export = collectionRouter;
