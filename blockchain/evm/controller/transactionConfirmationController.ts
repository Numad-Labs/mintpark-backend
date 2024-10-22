import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { TransactionConfirmationService } from "../services/transactionConfirmationService";

const txHashSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
});

export class TransactionConfirmationController {
  private confirmationService: TransactionConfirmationService;

  constructor(confirmationService: TransactionConfirmationService) {
    this.confirmationService = confirmationService;
  }

  confirmTransaction = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { txHash } = await txHashSchema.parseAsync(req.body);

      const status = await this.confirmationService.confirmTransaction(txHash);
      const details = await this.confirmationService.getTransactionDetails(
        txHash
      );

      res.json({
        success: true,
        status,
        details,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid transaction hash format",
        });
      }
      next(error);
    }
  };
}
