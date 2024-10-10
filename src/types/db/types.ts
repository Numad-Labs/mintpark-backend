import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

import type {
  COLLECTIBLE_STATUS,
  FILE_STATUS,
  COLLECTION_STATUS,
  ORDER_STATUS,
  TRANSACTION_STATUS,
  MINTING_TYPE,
  LAYER_TYPE,
} from "./enums";

export type Collectible = {
  id: Generated<string>;
  name: string;
  createdAt: Generated<Timestamp>;
  fileKey: string;
  status: Generated<COLLECTIBLE_STATUS>;
  generatedPsbtTxId: string | null;
  onHoldUntil: Timestamp | null;
  ownerAddress: string | null;
  collectionId: string;
  transactionId: string | null;
};
export type Collection = {
  id: Generated<string>;
  name: string;
  creator: string | null;
  description: string;
  price: Generated<number>;
  createdAt: Generated<Timestamp>;
  logoKey: string | null;
  walletLimit: Generated<number>;
  totalCount: Generated<number>;
  mintedCount: Generated<number>;
  feeRate: Generated<number>;
  POStartDate: Generated<string>;
  layerType: Generated<LAYER_TYPE>;
  status: Generated<COLLECTION_STATUS>;
  isLaunched: Generated<boolean>;
  ownerAddress: string;
};
export type File = {
  id: Generated<string>;
  createdAt: Generated<Timestamp>;
  fileKey: string;
  generatedPsbtTxId: string | null;
  status: Generated<FILE_STATUS>;
  collectionId: string;
};
export type Order = {
  orderId: Generated<string>;
  status: Generated<ORDER_STATUS>;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
  amount: Generated<number>;
  quantity: Generated<number>;
  feeRate: Generated<number>;
  networkFee: Generated<number>;
  serviceFee: Generated<number>;
  generatedPsbtTxId: string | null;
  layerType: Generated<LAYER_TYPE>;
  mintingType: Generated<MINTING_TYPE>;
  collectionId: string | null;
  collectibleKey: string | null;
  fundingAddress: string;
  fundingPrivateKey: string;
  userAddress: string;
};
export type Purchase = {
  id: Generated<string>;
  createdAt: Generated<Timestamp>;
  collectibleId: string;
  buyerId: string;
  transactionId: string;
};
export type Transaction = {
  id: Generated<string>;
  txId: string;
  createdAt: Generated<Timestamp>;
  status: Generated<TRANSACTION_STATUS>;
};
export type User = {
  id: Generated<string>;
  address: string;
  xpub: string | null;
  nickname: string | null;
  createdAt: Generated<Timestamp>;
  profileLink: string | null;
};
export type DB = {
  Collectible: Collectible;
  Collection: Collection;
  File: File;
  Order: Order;
  Purchase: Purchase;
  Transaction: Transaction;
  User: User;
};
