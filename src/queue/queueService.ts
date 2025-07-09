import { config } from "@config/config";
import logger from "../config/winston";
import axios from "axios";

export enum QueueType {
  IPFS_UPLOAD = "ipfs_upload"
}

export interface IpfsQueueItem {
  traitValueId?: string;
  collectibleId?: string;
  collectionId: string;
}

class QueueService {
  private baseUrl: string;
  private headers: { [key: string]: string };

  constructor() {
    this.baseUrl = config.QUEUE_PROCESSOR_URL;
    this.headers = {
      Authorization: `Bearer ${config.QUEUE_PROCESSOR_API_KEY}`
    };
  }

  public async enqueueBatch(
    items: IpfsQueueItem[],
    queueType: QueueType
  ): Promise<void> {
    console.log(items);
    console.log(queueType);

    if (items.length === 0) return;

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/queue`,
        {
          items,
          queueType
        },
        { headers: this.headers }
      );

      return response.data;
    } catch (error) {
      logger.error("Error enqueueing items to queue processor:", error);
      throw new Error(
        `Failed to enqueue items: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // /**
  //  * Helper to map phase to queue type
  //  */
  // public getInscriptionQueueType(
  //   phase: "trait" | "recursive" | "one-of-one"
  // ): QueueType {
  //   switch (phase) {
  //     case "trait":
  //       return QueueType.TRAIT_INSCRIPTION;
  //     case "recursive":
  //       return QueueType.RECURSIVE_INSCRIPTION;
  //     case "one-of-one":
  //       return QueueType.ONE_OF_ONE_INSCRIPTION;
  //     default:
  //       throw new Error(`Unknown phase: ${phase}`);
  //   }
  // }
}

export const queueService = new QueueService();
