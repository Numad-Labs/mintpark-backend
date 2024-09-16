import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

import type { COLLECTIBLE_STATUS, TRANSACTION_STATUS } from "./enums";

export type Collectible = {
  id: Generated<string>;
  name: string;
  createdAt: Generated<Timestamp>;
  fileKey: string;
  status: Generated<COLLECTIBLE_STATUS>;
  generatedPsbtTxId: string | null;
  ownerId: string | null;
  collectionId: string;
  transactionId: string | null;
};
export type Collection = {
  id: Generated<string>;
  name: string;
  ticker: string;
  description: string;
  supply: number;
  price: number;
  createdAt: Generated<Timestamp>;
  walletLimit: number;
  logoKey: string;
  totalCount: Generated<number>;
  mintedCount: Generated<number>;
  POStartDate: string;
  userId: string;
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
  xpub: string;
  nickname: string | null;
  createdAt: Generated<Timestamp>;
  profileLink: string | null;
};
export type DB = {
  Collectible: Collectible;
  Collection: Collection;
  Purchase: Purchase;
  Transaction: Transaction;
  User: User;
};
