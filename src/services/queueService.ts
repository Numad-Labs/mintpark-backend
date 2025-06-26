import { config } from "@config/config";
import logger from "../config/winston";
import axios from "axios";

export enum QueueType {
  IPFS_UPLOAD = "ipfs_upload",
  // VAULT_MINTING = "vault_minting",

  // Inscription queue types
  TRAIT_INSCRIPTION = "trait_inscription",
  RECURSIVE_INSCRIPTION = "recursive_inscription",
  ONE_OF_ONE_INSCRIPTION = "one_of_one_inscription"
}

export enum InscriptionPhase {
  TRAIT = "trait",
  RECURSIVE = "recursive",
  ONE_OF_ONE = "one-of-one"
}

export interface QueueItem {
  traitValueId?: string;
  collectibleId?: string;
  collectionId: string;
  phase?: InscriptionPhase;
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
    items: QueueItem[],
    queueType: QueueType
  ): Promise<void> {
    console.log(items);
    console.log(queueType);

    if (items.length === 0) return;

    items.map((item) => {
      if (queueType === QueueType.TRAIT_INSCRIPTION && !item.traitValueId)
        throw new Error("Invalid data format");

      if (queueType !== QueueType.TRAIT_INSCRIPTION && !item.collectibleId)
        throw new Error("Invalid data format");
    });

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
