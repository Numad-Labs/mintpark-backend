// services/fundingAddress.ts
import { ethers } from "ethers";
import { CustomError } from "../../../exceptions/CustomError";
import { config } from "../../../config/config";
import logger from "../../../config/winston";
import { EVM_CONFIG } from "../evm-config";

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
    this.vaultAddress = new ethers.Wallet(
      config.VAULT_PRIVATE_KEY,
      this.provider
    );
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
      data
    });

    const estimatedFee = gasPrice * gasLimit;

    return {
      estimatedFee: Number(ethers.formatEther(estimatedFee)),
      actualFee: 0, // Will be updated after transaction
      gasPriceGwei: Number(ethers.formatUnits(gasPrice, "gwei"))
    };
  }

  async getUnsignedFeeTransaction(
    fromAddress: string,
    value: string
  ): Promise<ethers.TransactionRequest> {
    try {
      // Get user's balance first
      const balance = await this.provider.getBalance(fromAddress);
      const valueInWei = ethers.parseEther(value);

      // Get network info to determine transaction type
      const network = await this.provider.getNetwork();
      const chainConfig = EVM_CONFIG.CHAINS[network.chainId.toString()];

      if (!chainConfig) {
        throw new CustomError(`Unsupported chain ID: ${network.chainId}`, 400);
      }

      // Create basic transaction
      const tx = {
        from: fromAddress,
        to: config.VAULT_ADDRESS,
        value: valueInWei,
        data: "0x"
      };

      // Get network conditions
      const [gasLimit, feeData, nonce] = await Promise.all([
        this.provider.estimateGas(tx).catch(() => ethers.getBigInt(21000)),
        this.provider.getFeeData(),
        this.provider.getTransactionCount(fromAddress)
      ]);

      let preparedTx: ethers.TransactionRequest;

      if (chainConfig.useLegacyGas) {
        // Legacy transaction (type 0)
        const gasPrice = feeData.gasPrice || ethers.parseUnits("5", "gwei");

        // Calculate adjusted gas price if multiplier exists
        const adjustedGasPrice = chainConfig.gasPriceMultiplier
          ? (gasPrice *
              BigInt(Math.floor(chainConfig.gasPriceMultiplier * 100))) /
            BigInt(100)
          : gasPrice;

        preparedTx = {
          from: fromAddress,
          to: config.VAULT_ADDRESS,
          value: valueInWei,
          gasLimit,
          gasPrice: adjustedGasPrice,
          nonce,
          chainId: Number(network.chainId),
          data: "0x",
          type: 0 // Legacy transaction type
        };

        // Calculate max gas cost for legacy tx
        const maxGasCost = gasLimit * adjustedGasPrice;
        const totalCost = valueInWei + maxGasCost;

        if (totalCost > balance) {
          throw new CustomError(
            `Insufficient funds. Required: ${ethers.formatEther(totalCost)} ETH, ` +
              `Available: ${ethers.formatEther(balance)} ETH`,
            400
          );
        }
      } else {
        // EIP-1559 transaction (type 2)
        const maxPriorityFeePerGas = ethers.parseUnits("0.1", "gwei");
        const baseFee = feeData.gasPrice || ethers.parseUnits("5", "gwei");
        const maxFeePerGas = baseFee + maxPriorityFeePerGas;

        preparedTx = {
          from: fromAddress,
          to: config.VAULT_ADDRESS,
          value: valueInWei,
          gasLimit,
          maxFeePerGas,
          maxPriorityFeePerGas,
          nonce,
          chainId: Number(network.chainId),
          data: "0x",
          type: 2 // EIP-1559 transaction type
        };

        // Calculate max gas cost for EIP-1559 tx
        const maxGasCost = gasLimit * maxFeePerGas;
        const totalCost = valueInWei + maxGasCost;

        if (totalCost > balance) {
          throw new CustomError(
            `Insufficient funds. Required: ${ethers.formatEther(totalCost)} ETH, ` +
              `Available: ${ethers.formatEther(balance)} ETH`,
            400
          );
        }
      }

      return preparedTx;
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw new CustomError(
        `Failed to create unsigned fee transaction: ${error}`,
        500
      );
    }
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
        data
      });
      const gasLimit = estimatedGas + (estimatedGas * BigInt(20)) / BigInt(100);

      // Prepare transaction
      const txRequest: ethers.TransactionRequest = {
        to,
        value: ethers.parseEther(value),
        data,
        nonce,
        gasLimit
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
        )
      ])) as ethers.TransactionReceipt;

      if (!receipt) {
        throw new CustomError("Transaction failed: No receipt received", 500);
      }

      // Calculate actual fee
      const actualFee = receipt.gasUsed * receipt.gasPrice;

      return {
        txHash: receipt.hash,
        actualFee: Number(ethers.formatEther(actualFee))
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
