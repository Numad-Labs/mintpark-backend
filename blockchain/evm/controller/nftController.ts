// src/controllers/nftController.ts
import { Request, Response } from "express";
import { NftService } from "../services/nftService";

export const nftController = {
  deployNFTContract: async (req: Request, res: Response) => {
    try {
      const { name, symbol, baseURI } = req.body;
      const unsignedTx =
        await NftService.createNFTContractDeploymentTransaction(
          name,
          symbol,
          baseURI
        );
      res.status(200).json({ unsignedTx });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  },

  mintNFT: async (req: Request, res: Response) => {
    try {
      const {
        contractAddress,
        recipientAddress,
        tokenId,
        name,
        description,
        imagePath,
      } = req.body;
      const unsignedTx = await NftService.createMintNFTTransaction(
        contractAddress,
        recipientAddress,
        tokenId,
        name,
        description,
        imagePath
      );
      res.status(200).json({ unsignedTx });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  },
};
