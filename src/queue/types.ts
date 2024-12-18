import { ORDER_TYPE } from "../types/db/enums";

export type SQSConfig = {
  region: string;
  queueUrl: string;
  visibilityTimeout: number;
  waitTimeSeconds: number;
};
