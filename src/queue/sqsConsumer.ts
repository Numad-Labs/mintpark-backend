// import {
//   SQSClient,
//   ReceiveMessageCommand,
//   DeleteMessageCommand,
//   Message
// } from "@aws-sdk/client-sqs";
// import logger from "../config/winston";
// import { SQSClientFactory } from "./sqsClient";

// export class SQSConsumer {
//   private sqsClient: SQSClient;
//   private queueUrl: string;
//   private isRunning: boolean = false;

//   constructor(region: string, queueUrl: string) {
//     this.sqsClient = SQSClientFactory.getInstance(region);
//     this.queueUrl = queueUrl;
//   }

//   async start(messageHandler: (message: Message) => Promise<void>) {
//     this.isRunning = true;

//     while (this.isRunning) {
//       try {
//         // Receive a single message from the queue
//         const receiveParams = {
//           QueueUrl: this.queueUrl,
//           MaxNumberOfMessages: 1, // Only receive one message at a time
//           WaitTimeSeconds: 20, // Long polling for better efficiency
//           VisibilityTimeout: 30 // 30 seconds to process the message
//         };

//         logger.info(`Sending ReceiveMessageCommand: ${new Date()}`);
//         const receiveCommand = new ReceiveMessageCommand(receiveParams);
//         const response = await this.sqsClient.send(receiveCommand);

//         if (response.Messages && response.Messages.length > 0) {
//           const message = response.Messages[0];

//           try {
//             // Process the single message
//             await messageHandler(message);

//             // Delete the message after successful processing
//             await this.deleteMessage(message);

//             logger.info(`Successfully processed message: ${message.MessageId}`);
//           } catch (error) {
//             logger.error(
//               `Error processing message ${message.MessageId}:`,
//               error
//             );
//             await this.deleteMessage(message);
//           }
//         }
//       } catch (error) {
//         logger.error("Error receiving message:", error);
//         // Add a small delay before retrying on error

//         await new Promise((resolve) => setTimeout(resolve, 1000));
//       }
//     }
//   }

//   private async deleteMessage(message: Message) {
//     const deleteParams = {
//       QueueUrl: this.queueUrl,
//       ReceiptHandle: message.ReceiptHandle
//     };

//     const deleteCommand = new DeleteMessageCommand(deleteParams);
//     await this.sqsClient.send(deleteCommand);
//   }

//   stop() {
//     this.isRunning = false;
//   }
// }
