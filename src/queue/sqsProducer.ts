import {
  SQSClient,
  SendMessageCommand,
  SendMessageBatchCommand,
  SendMessageBatchRequestEntry,
} from "@aws-sdk/client-sqs";
import { SQSClientFactory } from "./sqsClient";

export class SQSProducer {
  private sqsClient: SQSClient;
  private queueUrl: string;

  constructor(region: string, queueUrl: string) {
    this.sqsClient = SQSClientFactory.getInstance(region);
    this.queueUrl = queueUrl;
  }

  /**
   * Send a single message to the queue
   */
  async sendMessage(message: any, delaySeconds: number = 0) {
    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(message),
      DelaySeconds: delaySeconds,
    });

    try {
      const response = await this.sqsClient.send(command);
      console.log(
        `Message sent successfully. MessageId: ${response.MessageId}`
      );
      return response;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  /**
   * Send multiple messages in one batch (up to 10 messages)
   */
  async sendMessageBatch(messages: any[], delaySeconds: number = 0) {
    // SQS only allows up to 10 messages in a batch
    if (messages.length > 10) {
      throw new Error("Cannot send more than 10 messages in a single batch");
    }

    const entries: SendMessageBatchRequestEntry[] = messages.map(
      (message, index) => ({
        Id: `msg${index}`, // Unique ID for each message in the batch
        MessageBody: JSON.stringify(message),
        DelaySeconds: delaySeconds,
      })
    );

    const command = new SendMessageBatchCommand({
      QueueUrl: this.queueUrl,
      Entries: entries,
    });

    try {
      const response = await this.sqsClient.send(command);
      console.log(
        `Batch sent successfully. Successful: ${response.Successful?.length}, Failed: ${response.Failed?.length}`
      );
      return response;
    } catch (error) {
      console.error("Error sending message batch:", error);
      throw error;
    }
  }
}
