import { NextFunction, Request, Response } from "express";
import NFTService from "../services/nftService";
import MarketplaceService from "../services/marketplaceService";
import { EVM_CONFIG } from "../evm-config";
import { serializeBigInt } from "../utils";
import { CustomError } from "../../../src/exceptions/CustomError";
import { config } from "../../../src/config/config";

const nftService = new NFTService(
  EVM_CONFIG.RPC_URL,
  EVM_CONFIG.MARKETPLACE_ADDRESS,
  new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS)
);

// Helper function to serialize BigInt values

export const getDeploymentTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { initialOwner, name, symbol, price } = req.body;
    // Validate input
    if (!initialOwner || !name) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: initialOwner, name, or symbol",
      });
    }
    const unsignedTx = await nftService.getUnsignedDeploymentTransaction(
      initialOwner,
      config.VAULT_ADDRESS,
      name
    );
    // Serialize BigInt values before sending the response
    const serializedTx = serializeBigInt(unsignedTx);

    res.json({ success: true, unsignedTransaction: serializedTx });
  } catch (e) {
    next(e);
  }
};

// export const getMintNFTTransaction = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const { collectionAddress, to, tokenId } = req.body;
//     if (!req.files) {
//       throw new CustomError("not found", 400);
//     }

//     const files = req.files as Express.Multer.File[];
//     const unsignedTx = await nftService.getUnsignedMintNFTTransaction(
//       collectionAddress,
//       to,
//       tokenId,
//       1,
//       files
//     );
//     console.log("🚀 ~ unsignedTx:", unsignedTx);
//     const serializedTx = serializeBigInt(unsignedTx);

//     res.json({ success: true, unsignedTransaction: serializedTx });
//   } catch (e) {
//     next(e);
//   }
// };
// export const getMintBatchNFTTransaction = async (
//   req: Request,
//   res: Response
// ) => {
//   try {
//     const { collectionAddress, to, quantity } = req.body;
//     if (!req.files) {
//       throw new Error("no files");
//     }

//     const files = req.files as Express.Multer.File[];
//     const name = "bbb";
//     const unsignedTx = await nftService.getUnsignedBatchMintNFTTransaction(
//       collectionAddress,
//       to,
//       // name,
//       quantity,
//       files.
//     );
//     const serializedTx = serializeBigInt(unsignedTx);

//     res.json({ success: true, unsignedTransaction: serializedTx });
//   } catch (error) {
//     res.status(400).json({ error: (error as Error).message });
//   }
// };

// export const getListNFTTransaction = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const { collectionAddress, tokenId, pricePerToken, from } = req.body;
//     const unsignedTx = await nftService.getUnsignedListNFTTransaction(
//       collectionAddress,
//       tokenId,
//       pricePerToken,
//       from
//     );
//     const serializedTx = serializeBigInt(unsignedTx);

//     res.json({ success: true, unsignedTransaction: serializedTx });
//   } catch (e) {
//     next(e);
//   }
// };
