// src/controllers/evmAssetController.ts
import { Request, Response } from "express";
import { evmAssetService } from "../services/assetServices";

export const evmAssetController = {
  deployCollection: async (req: Request, res: Response) => {
    try {
      const { name, symbol, metadata } = req.body;
      const unsignedTx =
        await evmAssetService.createCollectionDeploymentTransaction(
          name,
          symbol,
          metadata
        );
      res.status(200).json({ unsignedTx });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  },

  mintCollectible: async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const { tokenURI, to } = req.body;
      const unsignedTx = await evmAssetService.createMintCollectibleTransaction(
        address,
        tokenURI,
        to
      );
      res.status(200).json({ unsignedTx });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  },

  // deployLaunchpad: async (req: Request, res: Response) => {
  //   try {
  //     const { name, symbol, mintingRules } = req.body;
  //     const unsignedTx =
  //       await evmAssetService.createLaunchpadDeploymentTransaction(
  //         name,
  //         symbol,
  //         mintingRules
  //       );
  //     res.status(200).json({ unsignedTx });
  //   } catch (error) {
  //     res.status(400).json({ error: (error as Error).message });
  //   }
  // },

  // mintOnDemand: async (req: Request, res: Response) => {
  //   try {
  //     const { address } = req.params;
  //     const { tokenURI, to } = req.body;
  //     const unsignedTx = await evmAssetService.createMintOnDemandTransaction(
  //       address,
  //       tokenURI,
  //       to
  //     );
  //     res.status(200).json({ unsignedTx });
  //   } catch (error) {
  //     res.status(400).json({ error: (error as Error).message });
  //   }
  // },

  // deployToken: async (req: Request, res: Response) => {
  //   try {
  //     const { name, symbol, initialSupply } = req.body;
  //     const unsignedTx = await evmAssetService.createTokenDeploymentTransaction(
  //       name,
  //       symbol,
  //       initialSupply
  //     );
  //     res.status(200).json({ unsignedTx });
  //   } catch (error) {
  //     res.status(400).json({ error: (error as Error).message });
  //   }
  // },

  // mintToken: async (req: Request, res: Response) => {
  //   try {
  //     const { address } = req.params;
  //     const { amount, to } = req.body;
  //     const unsignedTx = await evmAssetService.createMintTokenTransaction(
  //       address,
  //       amount,
  //       to
  //     );
  //     res.status(200).json({ unsignedTx });
  //   } catch (error) {
  //     res.status(400).json({ error: (error as Error).message });
  //   }
  // },

  listAsset: async (req: Request, res: Response) => {
    try {
      const { assetAddress, tokenId, price } = req.body;
      const unsignedTx = await evmAssetService.createListAssetTransaction(
        assetAddress,
        tokenId,
        price
      );
      res.status(200).json({ unsignedTx });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  },

  buyAsset: async (req: Request, res: Response) => {
    try {
      const { listingId } = req.body;
      const unsignedTx = await evmAssetService.createBuyAssetTransaction(
        listingId
      );
      res.status(200).json({ unsignedTx });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  },
};
