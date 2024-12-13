import { SQSClient } from "@aws-sdk/client-sqs";
import { config } from "../config/config";

export class SQSClientFactory {
  private static instance: SQSClient;

  static getInstance(region: string): SQSClient {
    if (!this.instance) {
      this.instance = new SQSClient({
        region,
        credentials: {
          accessKeyId: config.AWS_SQS_ACCESS_KEY,
          secretAccessKey: config.AWS_SQS_SECRET_KEY,
        },
      });
    }
    return this.instance;
  }
}
