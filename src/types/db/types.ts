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
  ROLES,
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
  contractAddress: string | null;
  createdAt: Generated<Timestamp>;
};
export type Launch = {
  id: Generated<string>;
  collectionId: string;
  isWhitelisted: boolean;
  wlStartsAt: string | null;
  wlEndsAt: string | null;
  wlMintPrice: number | null;
  wlMaxMintPerWallet: number | null;
  poStartsAt: Generated<string>;
  poEndsAt: Generated<string>;
  poMintPrice: number;
  poMaxMintPerWallet: number;
  createdAt: Generated<Timestamp>;
};
export type LaunchItem = {
  id: Generated<string>;
  launchId: string;
  fileKey: string;
  ipfsUrl: string | null;
  metadata: unknown | null;
  status: Generated<LAUNCH_ITEM_STATUS>;
  evmAssetId: string | null;
  name: string | null;
  onHoldUntil: Timestamp | null;
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
  fundingAddress: string | null;
  networkFee: number;
  serviceFee: number;
  fundingAmount: number;
  txId: string | null;
  privateKey: string | null;
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
  ipfsUrl: string | null;
  metadata: unknown | null;
  status: Generated<ORDER_ITEM_STATUS>;
  evmAssetId: string | null;
  name: string | null;
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
  role: Generated<ROLES>;
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
