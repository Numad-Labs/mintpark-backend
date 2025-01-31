// import { ORDER_TYPE } from "../types/db/enums";

// export type SQSConfig = {
//   region: string;
//   queueUrl: string;
//   visibilityTimeout: number;
//   waitTimeSeconds: number;
// };

export interface SQSMessageBody {
  messageId: string;
  mintRequest: MintRequest;
  attemptCount: number;
  lastError?: string;
  lastAttempt?: Date;
}

export interface MintRequest {
  userId: string;
  userLayerId: string;
  launchItemId: string;
  collectibleId: string;
  collectionId: string;
  collectionType:
    | "IPFS_CID"
    | "IPFS_FILE"
    | "INSCRIPTION"
    | "RECURSIVE_INSCRIPTION";
  collectionAddress: string;
  recipientAddress: string;
  nftId: string;
  mintPrice: string;
  orderId: string;
  uri?: string; // for IPFS mints
}
