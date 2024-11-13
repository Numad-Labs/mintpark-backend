// src/services/TransactionValidationService.ts

import { ethers } from "ethers";
import { CustomError } from "../../../src/exceptions/CustomError";

import { EVM_CONFIG } from "../evm-config";

export class TransactionValidationService {
  private provider: ethers.JsonRpcProvider;

  constructor(rpcUrl: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  async validateCollectionMintTransaction(
    txid: string,
    orderUserId: string,
    orderQuantity: number,
    collectionContractAddress: string
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

      // Get the NFT contract
      const nftContract = new ethers.Contract(
        collectionContractAddress,
        EVM_CONFIG.NFT_CONTRACT_ABI,
        this.provider
      );

      // Get transfer events from the receipt
      const transferEvents = txReceipt.logs.filter((log) => {
        try {
          return (
            log.address.toLowerCase() ===
              collectionContractAddress.toLowerCase() &&
            log.topics[0] === ethers.id("Transfer(address,address,uint256)")
          );
        } catch {
          return false;
        }
      });

      // Verify the number of mints matches order quantity
      if (transferEvents.length !== orderQuantity) {
        throw new CustomError(
          `Expected ${orderQuantity} mints, but found ${transferEvents.length}`,
          400
        );
      }
      // Get original transaction
      const tx = await this.provider.getTransaction(txid);
      if (!tx) throw new CustomError("Transaction not found", 400);

      // Check if transaction was sent by contract owner
      const owner = await nftContract.owner();
      const isSentByOwner = tx.from.toLowerCase() === owner.toLowerCase();

      // Verify each mint
      for (const event of transferEvents) {
        const iface = new ethers.Interface(EVM_CONFIG.NFT_CONTRACT_ABI);
        const parsedLog = iface.parseLog({
          topics: event.topics,
          data: event.data,
        });

        if (!parsedLog) continue;

        // Verify mint is from zero address (new mint)
        if (parsedLog.args[0] !== ethers.ZeroAddress) {
          throw new CustomError("Invalid mint: not from zero address", 400);
        }

        // Verify recipient is the order creator
        if (parsedLog.args[1].toLowerCase() !== orderUserId.toLowerCase()) {
          throw new CustomError("Invalid mint: wrong recipient", 400);
        }

        // Only check payment if not sent by owner
        if (!isSentByOwner) {
          // Verify the payment amount if mintFee is set
          const mintFee = await nftContract.mintFee();
          if (mintFee > 0) {
            if (mintFee > 0 && tx.value < mintFee * BigInt(orderQuantity)) {
              throw new CustomError("Insufficient payment for mint", 400);
            }
          }
        }
      }

      return true;
    } catch (error) {
      console.error("Validation error:", error);
      throw error;
    }
  }
  async validateBuyTransaction(
    txid: string,
    buyer: any,
    seller: any,
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
        "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
      ]);

      const parsedTransfer = nftInterface.parseLog({
        topics: transferEvents[0].topics,
        data: transferEvents[0].data,
      });

      if (!parsedTransfer) {
        throw new CustomError("Failed to parse transfer event", 400);
      }

      // Verify transfer details
      const transferredFrom = parsedTransfer.args[0].toLowerCase();
      const transferredTo = parsedTransfer.args[1].toLowerCase();
      const transferredTokenId = parsedTransfer.args[2].toString();

      if (transferredFrom !== seller.address.toLowerCase()) {
        throw new CustomError("Invalid seller address", 400);
      }

      if (transferredTo !== buyer.address.toLowerCase()) {
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
