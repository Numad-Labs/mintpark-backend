import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

import type {
  COLLECTIBLE_STATUS,
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
  price: number;
  createdAt: Generated<Timestamp>;
  walletLimit: Generated<number>;
  logoKey: string;
  totalCount: Generated<number>;
  mintedCount: Generated<number>;
  feeRate: Generated<number>;
  layer_type: Generated<LAYER_TYPE>;
  POStartDate: string;
  status: Generated<COLLECTION_STATUS>;
  isLaunched: Generated<boolean>;
  ownerAddress: string;
};
export type Order = {
  order_id: Generated<string>;
  status: Generated<ORDER_STATUS>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  amount: Generated<number>;
  quantity: Generated<number>;
  feeRate: Generated<number>;
  network_fee: Generated<number>;
  service_fee: Generated<number>;
  txid: string | null;
  layer_type: Generated<LAYER_TYPE>;
  minting_type: Generated<MINTING_TYPE>;
  collection_id: string | null;
  collectible_key: string | null;
  funding_address: string;
  funding_private_key: string;
  user_address: string;
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
  txid: string;
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
  Order: Order;
  Purchase: Purchase;
  Transaction: Transaction;
  User: User;
};
