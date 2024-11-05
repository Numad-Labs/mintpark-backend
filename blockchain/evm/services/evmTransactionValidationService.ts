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
    list: any,
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

      // Get the marketplace contract
      const marketplaceContract = new ethers.Contract(
        EVM_CONFIG.MARKETPLACE_ADDRESS,
        EVM_CONFIG.MARKETPLACE_ABI,
        this.provider
      );

      // Get the NFT contract
      const nftContract = new ethers.Contract(
        nftContractAddress,
        EVM_CONFIG.NFT_CONTRACT_ABI,
        this.provider
      );

      // Verify ItemSold event
      const saleEvents = txReceipt.logs.filter((log) => {
        try {
          return (
            log.address.toLowerCase() ===
              EVM_CONFIG.MARKETPLACE_ADDRESS.toLowerCase() &&
            log.topics[0] ===
              ethers.id("ItemSold(address,address,address,uint256,uint256)")
          );
        } catch {
          return false;
        }
      });

      if (saleEvents.length !== 1) {
        throw new CustomError("Invalid sale event count", 400);
      }

      // Parse the sale event
      const iface = new ethers.Interface(EVM_CONFIG.MARKETPLACE_ABI);
      const parsedSaleEvent = iface.parseLog({
        topics: saleEvents[0].topics,
        data: saleEvents[0].data,
      });

      if (!parsedSaleEvent) {
        throw new CustomError("Failed to parse sale event", 400);
      }

      // Verify seller address
      if (
        parsedSaleEvent.args[0].toLowerCase() !== seller.address.toLowerCase()
      ) {
        throw new CustomError("Invalid seller address", 400);
      }

      // Verify buyer address
      if (
        parsedSaleEvent.args[1].toLowerCase() !== buyer.address.toLowerCase()
      ) {
        throw new CustomError("Invalid buyer address", 400);
      }

      // Verify NFT contract address
      if (
        parsedSaleEvent.args[2].toLowerCase() !==
        nftContractAddress.toLowerCase()
      ) {
        throw new CustomError("Invalid NFT contract address", 400);
      }

      // Verify token ID
      if (parsedSaleEvent.args[3].toString() !== tokenId) {
        throw new CustomError("Invalid token ID", 400);
      }

      // Verify price
      const paidPrice = parsedSaleEvent.args[4].toString();
      if (
        paidPrice !== ethers.parseEther(expectedPrice.toString()).toString()
      ) {
        throw new CustomError("Price mismatch", 400);
      }

      // Verify NFT transfer
      const transferEvents = txReceipt.logs.filter((log) => {
        try {
          return (
            log.address.toLowerCase() === nftContractAddress.toLowerCase() &&
            log.topics[0] === ethers.id("Transfer(address,address,uint256)")
          );
        } catch {
          return false;
        }
      });

      if (transferEvents.length !== 1) {
        throw new CustomError("Invalid transfer event count", 400);
      }

      // Parse the transfer event
      const nftIface = new ethers.Interface(EVM_CONFIG.NFT_CONTRACT_ABI);
      const parsedTransferEvent = nftIface.parseLog({
        topics: transferEvents[0].topics,
        data: transferEvents[0].data,
      });

      if (!parsedTransferEvent) {
        throw new CustomError("Failed to parse transfer event", 400);
      }

      // Verify transfer details
      if (
        parsedTransferEvent.args[0].toLowerCase() !==
          seller.address.toLowerCase() ||
        parsedTransferEvent.args[1].toLowerCase() !==
          buyer.address.toLowerCase() ||
        parsedTransferEvent.args[2].toString() !== tokenId
      ) {
        throw new CustomError("Invalid NFT transfer details", 400);
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
