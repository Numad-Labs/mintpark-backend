import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

import type {
  ORDER_TYPE,
  ORDER_STATUS,
  ORDER_ITEM_STATUS,
  COLLECTION_TYPE,
  LIST_STATUS,
  LAUNCH_ITEM_STATUS,
  LAYER,
  NETWORK,
} from "./enums";

export type Collectible = {
  id: Generated<string>;
  name: string | null;
  collectionId: string;
  uniqueIdx: string;
  fileKey: string | null;
  createdAt: Generated<Timestamp>;
};
export type CollectibleTrait = {
  id: Generated<string>;
  collectibleId: string;
  traitId: string;
  value: string;
  rarity: number;
};
export type Collection = {
  id: Generated<string>;
  name: string;
  creator: string | null;
  description: string;
  logoKey: string | null;
  supply: number;
  type: Generated<COLLECTION_TYPE>;
  discordUrl: string | null;
  twitterUrl: string | null;
  websiteUrl: string | null;
  iconUrl: string | null;
  inscriptionIcon: string | null;
  slug: string | null;
  layerId: string | null;
  createdAt: Generated<Timestamp>;
};
export type Launch = {
  id: Generated<string>;
  collectionId: string;
  isWhitelisted: boolean;
  wlStartsAt: Timestamp | null;
  wlEndsAt: Timestamp | null;
  wlMintPrice: number | null;
  wlMaxMintPerWallet: number | null;
  poStartsAt: Timestamp;
  poEndsAt: Timestamp;
  poMintPrice: number;
  poMaxMintPerWallet: number;
};
export type LaunchItem = {
  id: Generated<string>;
  launchId: string;
  fileKey: string;
  metadata: unknown | null;
  status: Generated<LAUNCH_ITEM_STATUS>;
};
export type Layer = {
  id: Generated<string>;
  name: string;
  layer: Generated<LAYER>;
  network: Generated<NETWORK>;
};
export type List = {
  id: Generated<string>;
  collectibleId: string;
  sellerId: string;
  buyerId: string | null;
  address: string;
  privateKey: string;
  vaultTxid: string | null;
  vaultVout: number | null;
  inscribedAmount: Generated<number | null>;
  price: number;
  listedAt: Generated<Timestamp>;
  soldTxid: string | null;
  soldAt: Timestamp | null;
  status: Generated<LIST_STATUS>;
};
export type Order = {
  id: Generated<string>;
  userId: string;
  collectionId: string | null;
  quantity: number;
  feeRate: Generated<number>;
  fundingAddress: string;
  networkFee: number;
  serviceFee: number;
  fundingAmount: number;
  txId: string | null;
  privateKey: string;
  createdAt: Generated<Timestamp>;
  paidAt: Timestamp | null;
  mintedAt: Timestamp | null;
  expiredAt: Timestamp | null;
  orderType: Generated<ORDER_TYPE>;
  orderStatus: Generated<ORDER_STATUS>;
};
export type OrderItem = {
  id: Generated<string>;
  orderId: string;
  fileKey: string;
  metadata: unknown | null;
  status: Generated<ORDER_ITEM_STATUS>;
};
export type Purchase = {
  id: Generated<string>;
  userId: string;
  launchItemId: string;
  purchasedAt: Generated<Timestamp>;
  orderId: string;
};
export type Trait = {
  id: Generated<string>;
  name: string;
};
export type User = {
  id: Generated<string>;
  layerId: string | null;
  address: string;
  pubkey: string | null;
  xpub: string | null;
  createdAt: Generated<Timestamp>;
};
export type WlAddress = {
  id: Generated<string>;
  launchId: string;
  address: string;
};
export type DB = {
  Collectible: Collectible;
  CollectibleTrait: CollectibleTrait;
  Collection: Collection;
  Launch: Launch;
  LaunchItem: LaunchItem;
  Layer: Layer;
  List: List;
  Order: Order;
  OrderItem: OrderItem;
  Purchase: Purchase;
  Trait: Trait;
  User: User;
  WlAddress: WlAddress;
};
