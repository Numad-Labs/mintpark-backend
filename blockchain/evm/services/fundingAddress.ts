// services/fundingAddress.ts
import { ethers } from "ethers";
import { CustomError } from "../../../src/exceptions/CustomError";
import { config } from "../../../src/config/config";

interface FundingAddress {
  address: string;
  privateKey: string;
  publicKey: string;
}

interface TransactionFee {
  estimatedFee: number;
  actualFee: number;
  gasPriceGwei: number;
}
export class FundingAddressService {
  private readonly provider: ethers.JsonRpcProvider;
  private vaultAddress: ethers.Wallet;
  constructor(rpcUrl: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.vaultAddress = new ethers.Wallet(config.VAULT_PRIVATE_KEY);
  }

  getVaultAddress() {
    return this.vaultAddress.address;
  }
  async estimateTransactionFee(
    to: string,
    value: string,
    data: string = "0x"
  ): Promise<TransactionFee> {
    const gasPrice = (await this.provider.getFeeData()).gasPrice;
    if (!gasPrice) {
      throw new CustomError("Failed to get gas price", 500);
    }
    const gasLimit = await this.provider.estimateGas({
      to,
      value: ethers.parseEther(value),
      data,
    });

    const estimatedFee = gasPrice * gasLimit;

    return {
      estimatedFee: Number(ethers.formatEther(estimatedFee)),
      actualFee: 0, // Will be updated after transaction
      gasPriceGwei: Number(ethers.formatUnits(gasPrice, "gwei")),
    };
  }
  async signAndSendTransaction(
    to: string,
    value: string,
    data: string = "0x"
  ): Promise<{ txHash: string; actualFee: number }> {
    try {
      // Get latest nonce for the vault address
      const nonce = await this.provider.getTransactionCount(
        this.vaultAddress.address
      );

      // Get current network gas settings
      const feeData = await this.provider.getFeeData();
      if (!feeData.gasPrice && !feeData.maxFeePerGas) {
        throw new CustomError("Failed to get network fee data", 500);
      }

      // Estimate gas limit with a 20% buffer for safety
      const estimatedGas = await this.provider.estimateGas({
        to,
        value: ethers.parseEther(value),
        data,
      });
      const gasLimit = estimatedGas + (estimatedGas * BigInt(20)) / BigInt(100);

      // Prepare transaction
      const txRequest: ethers.TransactionRequest = {
        to,
        value: ethers.parseEther(value),
        data,
        nonce,
        gasLimit,
      };

      // Set gas price based on network type (EIP-1559 or legacy)
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        // EIP-1559 transaction
        txRequest.maxFeePerGas = feeData.maxFeePerGas;
        txRequest.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
        txRequest.type = 2;
      } else if (feeData.gasPrice) {
        // Legacy transaction
        txRequest.gasPrice = feeData.gasPrice;
        txRequest.type = 0;
      }

      // Check if vault has sufficient balance
      const balance = await this.provider.getBalance(this.vaultAddress.address);
      const requiredAmount =
        ethers.parseEther(value) +
        gasLimit * (feeData.gasPrice || feeData.maxFeePerGas!);

      if (balance < requiredAmount) {
        throw new CustomError(
          `Insufficient balance in vault. Required: ${ethers.formatEther(
            requiredAmount
          )} ETH, Available: ${ethers.formatEther(balance)} ETH`,
          400
        );
      }

      // Sign and send transaction
      const tx = await this.vaultAddress.sendTransaction(txRequest);

      // Wait for transaction confirmation with timeout
      const receipt = (await Promise.race([
        tx.wait(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Transaction confirmation timeout")),
            60000
          )
        ),
      ])) as ethers.TransactionReceipt;

      if (!receipt) {
        throw new CustomError("Transaction failed: No receipt received", 500);
      }

      // Calculate actual fee
      const actualFee = receipt.gasUsed * receipt.gasPrice;

      return {
        txHash: receipt.hash,
        actualFee: Number(ethers.formatEther(actualFee)),
      };
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }

      // // Handle specific error cases
      // if (error.code === "INSUFFICIENT_FUNDS") {
      //   throw new CustomError(
      //     "Insufficient funds in vault address for transaction",
      //     400
      //   );
      // }
      // if (error.code === "REPLACEMENT_UNDERPRICED") {
      //   throw new CustomError("Transaction gas price too low", 400);
      // }
      // if (error.code === "NONCE_EXPIRED") {
      //   throw new CustomError("Transaction nonce is expired or invalid", 400);
      // }

      // Generic error handling
      throw new CustomError(
        `Transaction failed: ${error || "Unknown error"}`,
        500
      );
    }
  }
}