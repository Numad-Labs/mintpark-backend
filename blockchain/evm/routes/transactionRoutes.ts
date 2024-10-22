// routes/transactionRoutes.ts
import express from "express";
import { TransactionConfirmationService } from "../services/transactionConfirmationService";
import { TransactionConfirmationController } from "../controller/transactionConfirmationController";
import { config } from "../../../src/config/config";
import { EVM_CONFIG } from "../evm-config";

const transactionRouter = express.Router();
const confirmationService = new TransactionConfirmationService(
  EVM_CONFIG.RPC_URL!
);
const confirmationController = new TransactionConfirmationController(
  confirmationService
);

transactionRouter.post("/confirm", confirmationController.confirmTransaction);

export default transactionRouter;
