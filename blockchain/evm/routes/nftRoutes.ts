import express from "express";
import { parseFiles } from "../../../src/middlewares/fileParser";
import {
  getDeploymentTransaction,
  getMintNFTTransaction,
  getListNFTTransaction,
  getMintBatchNFTTransaction,
} from "../controller/nftController";
import { TransactionConfirmationService } from "../services/transactionConfirmationService";
import { TransactionConfirmationController } from "../controller/transactionConfirmationController";
import { EVM_CONFIG } from "../evm-config";
import { createLaunchpadListing } from "../controller/launchpadController";

const confirmationService = new TransactionConfirmationService(
  EVM_CONFIG.RPC_URL
);
const confirmationController = new TransactionConfirmationController(
  confirmationService
);

const nftRouter = express.Router();

nftRouter.post("/deploy-collection", getDeploymentTransaction);
nftRouter.post("/mint", parseFiles("image", true), getMintNFTTransaction);
nftRouter.post(
  "/mint-batch",
  parseFiles("images", false),
  getMintBatchNFTTransaction
);
nftRouter.post("/list", getListNFTTransaction);

nftRouter.post("/confirm", confirmationController.confirmTransaction);
nftRouter.post("/create-launchpad", createLaunchpadListing);

export = nftRouter;
