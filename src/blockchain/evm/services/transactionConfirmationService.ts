// transactionConfirmationService.ts
import { ethers } from "ethers";
import { redis } from "../../..";
import { CustomError } from "../../../exceptions/CustomError";
import logger from "../../../config/winston";
import { EVM_CONFIG } from "../evm-config";
// import { redis } from "../../../src";
interface TransactionStatus {
  status: "pending" | "confirmed" | "failed";
  blockNumber?: number;
  confirmations?: number;
  error?: string;
}

interface MintValidationResult {
  isValid: boolean;
  tokenId?: string;
  owner?: string;
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
      const cachedStatus = await redis.get(`tx:${txHash}`);
      if (cachedStatus) {
        return JSON.parse(cachedStatus);
      }

      // Get transaction receipt
      const receipt = await this.provider.getTransactionReceipt(txHash);
      console.log(
        "🚀 ~ TransactionConfirmationService ~ confirmTransaction ~ receipt:",
        receipt
      );

      if (!receipt) {
        const status: TransactionStatus = { status: "pending" };
        await redis.setex(`tx:${txHash}`, 3600, JSON.stringify(status)); // Cache for 1 hour
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
      await redis.setex(`tx:${txHash}`, cacheTime, JSON.stringify(status));

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
        throw new CustomError("Transaction not found", 400);
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
      throw error;
    }
  }
  async validateMintedTokenId(
    txHash: string,
    contractAddress: string,
    expectedTokenId: string,
    expectedOwner: string
  ): Promise<MintValidationResult> {
    try {
      // Get transaction receipt to ensure tx is confirmed
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return { isValid: false, error: "Transaction not confirmed yet" };
      }

      if (receipt.status === 0) {
        return { isValid: false, error: "Transaction failed" };
      }

      // Create contract interface for the NFT
      const contract = new ethers.Contract(
        contractAddress,
        EVM_CONFIG.DIRECT_MINT_NFT_ABI,
        this.provider
      );

      // First, parse the transaction logs to find the Transfer event with the specific tokenId
      // This is more efficient than querying all Transfer events
      let tokenIdTransferFound = false;
      let transferTo: string | undefined;

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === contractAddress.toLowerCase()) {
          try {
            const parsedLog = contract.interface.parseLog({
              topics: log.topics as string[],
              data: log.data
            });

            if (parsedLog && parsedLog.name === "Transfer") {
              const tokenId = parsedLog.args[2].toString();

              // If this is the transfer for our expected token
              if (tokenId === expectedTokenId) {
                tokenIdTransferFound = true;
                transferTo = parsedLog.args[1].toLowerCase();
                break;
              }
            }
          } catch (e) {
            // Skip logs that can't be parsed with our ABI
            continue;
          }
        }
      }

      // If we didn't find the token transfer in the logs, it might be a different transaction
      if (!tokenIdTransferFound) {
        const result = {
          isValid: false,
          error: "Token ID not minted in this transaction"
        };
        return result;
      }

      const currentOwner = receipt.from;

      // Double check by verifying current ownership if the token transfer was found
      // This provides an extra layer of validation beyond just checking transaction logs
      try {
        // Convert addresses to lowercase for comparison
        const ownerMatches =
          currentOwner.toLowerCase() === expectedOwner.toLowerCase();

        const transferMatches = transferTo === expectedOwner.toLowerCase();

        const isValid = ownerMatches && transferMatches;

        const result = {
          isValid,
          tokenId: expectedTokenId,
          owner: currentOwner,
          error: isValid ? undefined : "Token owner mismatch"
        };

        return result;
      } catch (e) {
        // If ownerOf reverts, the token may not exist
        return {
          isValid: false,
          error: "Token ID does not exist or cannot verify ownership"
        };
      }
    } catch (error) {
      logger.error("Error validating minted token:", error);
      return {
        isValid: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error validating mint"
      };
    }
  }

  async validateBuyTransaction(
    txid: string,
    buyerAddress: any,
    sellerAddress: any,
    nftContractAddress: string,
    tokenId: string,
    expectedPrice: string
  ): Promise<boolean> {
    try {
      // Get transaction receipt
      const txReceipt = await this.provider.getTransactionReceipt(txid);
      if (!txReceipt) {
        throw new CustomError("Transaction not found", 400);
      }

      // Verify transaction status
      if (!txReceipt.status) {
        throw new CustomError("Transaction failed", 400);
      }

      // Verify NFT transfer
      const transferEventTopic = ethers.id("Transfer(address,address,uint256)");
      const transferEvents = txReceipt.logs.filter((log) => {
        return (
          log.address.toLowerCase() === nftContractAddress.toLowerCase() &&
          log.topics[0] === transferEventTopic
        );
      });

      if (transferEvents.length === 0) {
        throw new CustomError("No NFT transfer found", 400);
      }

      // Parse the transfer event
      const nftInterface = new ethers.Interface([
        "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
      ]);

      const parsedTransfer = nftInterface.parseLog({
        topics: transferEvents[0].topics,
        data: transferEvents[0].data
      });

      if (!parsedTransfer) {
        throw new CustomError("Failed to parse transfer event", 400);
      }

      // Verify transfer details
      const transferredFrom = parsedTransfer.args[0].toLowerCase();

      const transferredTo = parsedTransfer.args[1].toLowerCase();

      const transferredTokenId = parsedTransfer.args[2].toString();

      if (transferredFrom !== sellerAddress.toLowerCase()) {
        throw new CustomError("Invalid seller address", 400);
      }

      if (transferredTo !== buyerAddress.toLowerCase()) {
        throw new CustomError("Invalid buyer address", 400);
      }

      if (transferredTokenId !== tokenId) {
        throw new CustomError("Invalid token ID", 400);
      }

      // Verify payment amount
      const tx = await this.provider.getTransaction(txid);
      if (!tx) {
        throw new CustomError("Transaction not found", 400);
      }

      if (
        tx.value.toString() !==
        ethers.parseEther(expectedPrice.toString()).toString()
      ) {
        throw new CustomError("Invalid payment amount", 400);
      }

      return true;
    } catch (error) {
      console.error("Buy validation error:", error);
      throw error;
    }
  }
}
