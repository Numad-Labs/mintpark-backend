// transactionConfirmationService.ts
import { ethers } from "ethers";
// import { redis } from "../../..";
// import { redis } from "../../../src";
interface TransactionStatus {
  status: "pending" | "confirmed" | "failed";
  blockNumber?: number;
  confirmations?: number;
  error?: string;
}

export class TransactionConfirmationService {
  private provider: ethers.JsonRpcProvider;
  private requiredConfirmations: number;

  constructor(providerUrl: string, requiredConfirmations: number = 3) {
    this.provider = new ethers.JsonRpcProvider(providerUrl);
    // this.redis = new Redis(redisUrl);
    this.requiredConfirmations = requiredConfirmations;
  }

  async confirmTransaction(txHash: string): Promise<TransactionStatus> {
    try {
      // Check if we've already processed this transaction
      // const cachedStatus = await redis.get(`tx:${txHash}`);
      // if (cachedStatus) {
      //   return JSON.parse(cachedStatus);
      // }

      // Get transaction receipt
      const receipt = await this.provider.getTransactionReceipt(txHash);
      console.log(
        "🚀 ~ TransactionConfirmationService ~ confirmTransaction ~ receipt:",
        receipt
      );

      if (!receipt) {
        const status: TransactionStatus = { status: "pending" };
        // await redis.setex(`tx:${txHash}`, 3600, JSON.stringify(status)); // Cache for 1 hour
        return status;
      }

      // Get current block number for confirmation count
      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber + 1;

      let status: TransactionStatus;

      if (receipt.status === 0) {
        status = {
          status: "failed",
          blockNumber: receipt.blockNumber,
          error: "Transaction reverted"
        };
      } else if (confirmations >= this.requiredConfirmations) {
        status = {
          status: "confirmed",
          blockNumber: receipt.blockNumber,
          confirmations
        };
      } else {
        status = {
          status: "pending",
          blockNumber: receipt.blockNumber,
          confirmations
        };
      }

      // Cache the result
      const cacheTime = status.status === "confirmed" ? 86400 : 3600; // 24 hours for confirmed, 1 hour for others
      // await redis.setex(`tx:${txHash}`, cacheTime, JSON.stringify(status));

      return status;
    } catch (error) {
      console.error("Error confirming transaction:", error);
      throw error;
    }
  }

  async getTransactionDetails(txHash: string) {
    try {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) {
        throw new Error("Transaction not found");
      }

      const receipt = await this.provider.getTransactionReceipt(txHash);

      return {
        from: tx.from,
        to: tx.to,
        value: tx.value.toString(),

        gasPrice: tx.gasPrice?.toString(),
        gasLimit: tx.gasLimit.toString(),
        nonce: tx.nonce,
        deployedContractAddress: receipt
          ? receipt.contractAddress
            ? receipt.contractAddress.toString()
            : null
          : null,
        data: tx.data,
        blockNumber: receipt?.blockNumber,
        status: receipt?.status,
        //  === 1
        //   ? "success"
        //   : receipt?.status === 0
        //   ? "failed"
        //   : "pending",
        gasUsed: receipt?.gasUsed?.toString(),
        // effectiveGasPrice: receipt?.effectiveGasPrice?.toString(),
        confirmations: receipt
          ? (await this.provider.getBlockNumber()) - receipt.blockNumber + 1
          : 0
      };
    } catch (error) {
      console.error("Error getting transaction details:", error);
      throw error;
    }
  }
}
