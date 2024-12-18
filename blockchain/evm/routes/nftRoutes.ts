import express from "express";
import { parseFiles } from "../../../src/middlewares/fileParser";
import {
  getDeploymentTransaction,
  getMintNFTTransaction,
  getListNFTTransaction,
  // getMintBatchNFTTransaction,
} from "../controller/nftController";
import { TransactionConfirmationService } from "../services/transactionConfirmationService";
import { TransactionConfirmationController } from "../controller/transactionConfirmationController";
import { EVM_CONFIG } from "../evm-config";
import {
  createLaunchpadListing,
  getLaunchpadMintTransaction,
} from "../controller/launchpadController";

const confirmationService = new TransactionConfirmationService(
  EVM_CONFIG.RPC_URL
);
const confirmationController = new TransactionConfirmationController(
  confirmationService
);

const nftRouter = express.Router();

nftRouter.post("/deploy-collection", getDeploymentTransaction);
// nftRouter.post("/mint", parseFiles("image", true), getMintNFTTransaction);
// nftRouter.post(
//   "/mint-batch",
//   parseFiles("images", false),
//   getMintBatchNFTTransaction
// );
nftRouter.post("/list", getListNFTTransaction);

nftRouter.post("/confirm", confirmationController.confirmTransaction);
nftRouter.post("/create-launchpad", createLaunchpadListing);

// Get mint transaction
nftRouter.post("/buyfrom-launchpad", async (req, res) => {
  try {
    const { buyer, launchId, collectionAddress } = req.body;
    if (!buyer) {
      return res.status(400).json({ error: "Buyer address is required" });
    }

    const transaction = await getLaunchpadMintTransaction(
      launchId,
      buyer,
      collectionAddress
    );
    res.json(transaction);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

export = nftRouter;
