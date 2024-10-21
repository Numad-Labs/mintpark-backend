import { NextFunction, Request, Response } from "express";
import NFTService from "../services/newNftService";
// import NFTService from "../evm/services/nftService";
import { EVM_CONFIG } from "../evm-config";

const nftService = new NFTService(
  EVM_CONFIG.RPC_URL,
  EVM_CONFIG.MARKETPLACE_ADDRESS
);

// Helper function to serialize BigInt values
function serializeBigInt(obj: any): any {
  if (typeof obj === "bigint") {
    return obj.toString();
  } else if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  } else if (typeof obj === "object" && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, serializeBigInt(value)])
    );
  }
  return obj;
}

export const getDeploymentTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { initialOwner, name, symbol } = req.body;
    // Validate input
    if (!initialOwner || !name || !symbol) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: initialOwner, name, or symbol",
      });
    }
    const unsignedTx = await nftService.getUnsignedDeploymentTransaction(
      initialOwner,
      name,
      symbol
    );
    // Serialize BigInt values before sending the response
    const serializedTx = serializeBigInt(unsignedTx);

    res.json({ success: true, unsignedTransaction: serializedTx });
  } catch (e) {
    next(e);
  }
};

export const getMintNFTTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { collectionAddress, to, tokenId, uri } = req.body;
    const unsignedTx = await nftService.getUnsignedMintNFTTransaction(
      collectionAddress,
      to,
      tokenId,
      uri
    );
    console.log("🚀 ~ unsignedTx:", unsignedTx);
    const serializedTx = serializeBigInt(unsignedTx);

    res.json({ success: true, unsignedTransaction: serializedTx });
  } catch (e) {
    next(e);
  }
};

export const getListNFTTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { collectionAddress, tokenId, pricePerToken, from } = req.body;
    const unsignedTx = await nftService.getUnsignedListNFTTransaction(
      collectionAddress,
      tokenId,
      pricePerToken,
      from
    );
    const serializedTx = serializeBigInt(unsignedTx);

    res.json({ success: true, unsignedTransaction: serializedTx });
  } catch (e) {
    next(e);
  }
};
