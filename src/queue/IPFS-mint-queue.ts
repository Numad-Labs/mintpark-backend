import { randomUUID } from "crypto";
import { redis } from "..";
import logger from "../config/winston";
import { sleep } from "../utils/timer";
import { db } from "../utils/db";
import { launchItemRepository } from "../repositories/launchItemRepository";
import NFTService from "../blockchain/evm/services/nftService";
import { EVM_CONFIG } from "../blockchain/evm/evm-config";
import { SQSMessageBody } from "./types";
import { CustomError } from "../exceptions/CustomError";
import { updateMintRecords } from "../services/launchServices";
import { collectionRepository } from "../repositories/collectionRepository";
import { purchaseRepository } from "../repositories/purchaseRepository";
import { userRepository } from "../repositories/userRepository";
import { orderRepository } from "../repositories/orderRepostory";
import { config } from "../config/config";
import { SQSClientFactory } from "./sqsClient";
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient
} from "@aws-sdk/client-sqs";
import { collectibleRepository } from "../repositories/collectibleRepository";

const LOCK_SCRIPT = `
  local existing = redis.call('get', KEYS[1])
  if existing then
    return 0
  end
  redis.call('set', KEYS[1], ARGV[1], 'PX', ARGV[2])
  return 1
`;

const UNLOCK_SCRIPT = `
  local existing = redis.call('get', KEYS[1])
  if not existing then
    return 1
  end
  if existing == ARGV[1] then
    redis.call('del', KEYS[1])
    return 1
  end
  return 0
`;

export class QueueProcessor {
  private sqsClient: SQSClient;
  private queueUrl: string;
  private isProcessing: boolean = false;
  private workerId: string;
  private lockKey = "mint:global:lock";
  private lockTtl = 30000; // 30 seconds

  constructor(region: string, queueUrl: string) {
    this.workerId = randomUUID();
    this.sqsClient = SQSClientFactory.getInstance(region);
    this.queueUrl = queueUrl;
  }

  async start() {
    this.isProcessing = true;
    logger.info(`Starting queue processor with worker ID: ${this.workerId}`);

    while (this.isProcessing) {
      try {
        const hasLock = await this.acquireLock();
        if (!hasLock) {
          await sleep(1000);
          continue;
        }

        try {
          await this.processNextMessage();
        } finally {
          await this.releaseLock();
        }
      } catch (error) {
        logger.error("Error in processing loop:", error);
        await sleep(1000);
      }
    }
  }

  stop() {
    this.isProcessing = false;
    logger.info("Stopping queue processor");
  }

  private async acquireLock(): Promise<boolean> {
    try {
      const result = await redis.eval(
        LOCK_SCRIPT,
        1,
        this.lockKey,
        this.workerId,
        this.lockTtl
      );
      return result === 1;
    } catch (error) {
      logger.error("Error acquiring lock:", error);
      return false;
    }
  }

  private async releaseLock(): Promise<boolean> {
    try {
      const result = await redis.eval(
        UNLOCK_SCRIPT,
        1,
        this.lockKey,
        this.workerId
      );
      return result === 1;
    } catch (error) {
      logger.error("Error releasing lock:", error);
      return false;
    }
  }

  private async isMessageProcessed(messageId: string): Promise<boolean> {
    const exists = await redis.exists(`mint:processed:${messageId}`);
    return exists === 1;
  }

  private async markMessageProcessed(
    messageId: string,
    txHash: string
  ): Promise<void> {
    await redis.set(
      `mint:processed:${messageId}`,
      txHash,
      "EX",
      86400 // 24 hours TTL
    );
  }

  private async processNextMessage() {
    // const response = await this.sqs
    //   .receiveMessage({
    //     QueueUrl: `https://sqs.eu-central-1.amazonaws.com/992382532523/${config.AWS_SQS_NAME}`,
    //     MaxNumberOfMessages: 1,
    //     VisibilityTimeout: 25,
    //     WaitTimeSeconds: 30
    //   })
    //   .promise();

    const receiveParams = {
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: 1, // Only receive one message at a time
      WaitTimeSeconds: 20, // Long polling for better efficiency
      VisibilityTimeout: 30 // 30 seconds to process the message
    };

    logger.info(`Sending ReceiveMessageCommand: ${new Date()}`);
    const receiveCommand = new ReceiveMessageCommand(receiveParams);
    const response = await this.sqsClient.send(receiveCommand);

    if (!response.Messages || response.Messages.length === 0) {
      return;
    }

    const message = response.Messages[0];
    if (!message.Body) return;
    const mintMessage: SQSMessageBody = JSON.parse(message.Body);

    try {
      // Check if already processed
      if (await this.isMessageProcessed(mintMessage.messageId)) {
        logger.info(
          `Message ${mintMessage.messageId} already processed, skipping`
        );
        await this.deleteMessage(message.ReceiptHandle!);
        return;
      }

      await this.processSingleMessage(message, mintMessage);
    } catch (error) {
      logger.info(`error cauhgt on processNextMessage: ${error}`);
      await this.handleProcessingError(message, mintMessage, error);
    }
  }

  private async processSingleMessage(
    message: any,
    mintMessage: SQSMessageBody
  ) {
    logger.info(`started processing single message: ${mintMessage}`);
    try {
      const body = mintMessage.mintRequest;

      const isLaunchItemOnHold = await launchItemRepository.getOnHoldById(
        db,
        body.launchItemId
      );
      if (isLaunchItemOnHold && isLaunchItemOnHold.onHoldBy !== body.userId)
        throw new CustomError(
          "This launch item is currently reserved to another user.",
          400
        );
      if (isLaunchItemOnHold && isLaunchItemOnHold.status === "SOLD")
        throw new CustomError("Launch item has already been sold.", 400);

      const user = await userRepository.getByUserLayerId(body.userLayerId);
      if (!user) throw new CustomError("User not found.", 400);
      if (user.id !== body.userId)
        throw new CustomError(
          "You are not allowed to buy from this account.",
          400
        );
      if (!user.isActive)
        throw new CustomError("This account is deactivated.", 400);

      // Process mint
      const result = await this.processCollectionMint(mintMessage.mintRequest);
      if (!result) throw new Error("Could not mint in the queue.");

      //DB state update
      await db.transaction().execute(async (trx) => {
        const collection =
          await collectionRepository.incrementCollectionSupplyById(
            trx,
            body.collectionId
          );

        if (collection.status === "UNCONFIRMED") {
          await collectionRepository.update(trx, collection.id, {
            status: "CONFIRMED"
          });
        }

        await collectibleRepository.update(trx, body.collectibleId, {
          status: "CONFIRMED",
          mintingTxId: body.txid,
          cid: body.uri,
          uniqueIdx: body.uniqueIdx
        });

        // Update launch item and create purchase record
        const soldLaunchItem = await launchItemRepository.update(
          trx,
          body.launchItemId,
          {
            status: "SOLD"
          }
        );

        await purchaseRepository.create(trx, {
          userId: body.userId,
          launchItemId: soldLaunchItem.id,
          purchasedAddress: user.address
        });

        // Update order status
        await orderRepository.update(trx, body.orderId, {
          orderStatus: "DONE"
        });

        // Mark as processed in Redis
        await this.markMessageProcessed(mintMessage.messageId, result);
      });

      await this.deleteMessage(message.ReceiptHandle!);
      logger.info(
        `Successfully processed mint message: ${mintMessage.messageId}`
      );
    } catch (error) {
      logger.error(`Error processing message: ${mintMessage.messageId}`, error);
      throw error;
    }
  }

  private async deleteMessage(receiptHandle: string) {
    const command = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle
    });
    await this.sqsClient.send(command);
  }

  private async handleProcessingError(
    message: any,
    mintMessage: any,
    error: any
  ) {
    const attemptCount = mintMessage.attemptCount || 0;
    const updatedMessage = {
      ...mintMessage,
      attemptCount: attemptCount + 1,
      lastError: error.message,
      lastAttempt: new Date()
    };

    logger.info(
      `failed processing ${message}, ${mintMessage}, attemp: ${
        attemptCount + 1
      }`
    );

    if (updatedMessage.attemptCount >= 3) {
      // Max 3 retries
      await this.moveToFailedMints(updatedMessage);
      await this.deleteMessage(message.ReceiptHandle!);
    }
  }

  private async moveToFailedMints(message: any) {
    await db.transaction().execute(async (trx) => {
      //INSERT INTO FAILED MINT TABLE
      await db
        .insertInto("FailedMint")
        .values({
          userId: message.mintRequest.userId,
          launchItemId: message.mintRequest.launchItemId
        })
        .returningAll()
        .execute();

      //RELEASE LONG RESERVATION
      await launchItemRepository.update(trx, message.mintRequest.launchItemId, {
        onHoldBy: null,
        onHoldUntil: null
      });
    });
  }

  private async processCollectionMint(mintRequest: any) {
    const userLayer = await userRepository.getByUserLayerId(
      mintRequest.userLayerId
    );
    if (!userLayer?.chainId)
      throw new Error("Couldn't find user layer chainid");
    const chainConfig = EVM_CONFIG.CHAINS[userLayer.chainId];
    const nftService = new NFTService(chainConfig.RPC_URL);

    switch (mintRequest.collectionType) {
      case "IPFS_CID":
      case "IPFS_FILE":
        return await nftService.mintIpfsNFTUsingVault(
          mintRequest.collectionAddress,
          mintRequest.recipientAddress,
          mintRequest.nftId,
          mintRequest.uri,
          parseFloat(mintRequest.mintPrice)
        );

      case "INSCRIPTION":
      case "RECURSIVE_INSCRIPTION":
        break;

      default:
        throw new Error("Unsupported collection type");
    }
  }
}
