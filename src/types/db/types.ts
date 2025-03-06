import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

import type {
  ORDER_TYPE,
  ORDER_STATUS,
  ORDER_ITEM_TYPE,
  ORDER_ITEM_STATUS,
  COLLECTION_STATUS,
  COLLECTION_TYPE,
  COLLECTIBLE_STATUS,
  LAUNCH_STATUS,
  LAUNCH_ITEM_STATUS,
  LIST_STATUS,
  LAYER,
  LAYER_TYPE,
  NETWORK,
  ROLES,
  LAUNCH_PHASE
} from "./enums";

export type Airdrop = {
  id: Generated<string>;
  createdAt: Generated<Timestamp>;
  address: string;
};
export type Collectible = {
  id: Generated<string>;
  name: string;
  fileKey: string | null;
  highResolutionImageUrl: string | null;
  cid: string | null;
  uniqueIdx: string | null;
  nftId: string;
  metadata: unknown | null;
  status: Generated<COLLECTIBLE_STATUS>;
  createdAt: Generated<Timestamp>;
  mintingTxId: string | null;
  lockingAddress: string | null;
  lockingPrivateKey: string | null;
  parentCollectibleId: string | null;
  collectionId: string;
  fileName: string | null;
};
export type CollectibleTrait = {
  id: Generated<string>;
  createdAt: Generated<Timestamp>;
  collectibleId: string;
  traitValueId: string;
};
export type Collection = {
  id: Generated<string>;
  name: string;
  creatorName: string | null;
  description: string;
  discordUrl: string | null;
  twitterUrl: string | null;
  websiteUrl: string | null;
  iconUrl: string | null;
  inscriptionIcon: string | null;
  slug: string | null;
  logoKey: string | null;
  supply: number;
  ownerCount: number | null;
  contractAddress: string | null;
  type: Generated<COLLECTION_TYPE>;
  status: Generated<COLLECTION_STATUS>;
  createdAt: Generated<Timestamp>;
  layerId: string;
  creatorId: string | null;
  creatorUserLayerId: string | null;
  parentCollectionId: string | null;
  badgeCid: string | null;
  badgeSupply: number | null;
  isBadge: Generated<boolean>;
  updatedAt: Timestamp | null;
  badgeCurrentNftId: number | null;
  contractVersion: string | null;
};
export type Currency = {
  id: Generated<string>;
  ticker: string;
  price: Generated<number>;
  updatedAt: Generated<Timestamp | null>;
};
export type FailedMint = {
  id: Generated<string>;
  createdAt: Generated<Timestamp>;
  userId: string;
  launchItemId: string;
};
export type Launch = {
  id: Generated<string>;
  collectionId: string;
  isWhitelisted: Generated<boolean>;
  wlStartsAt: string | null;
  wlEndsAt: string | null;
  wlMintPrice: number | null;
  wlMaxMintPerWallet: number | null;
  poStartsAt: string;
  poEndsAt: string | null;
  poMintPrice: number;
  poMaxMintPerWallet: number;
  createdAt: Generated<Timestamp>;
  status: Generated<LAUNCH_STATUS>;
  userLayerId: string;
  userId: string | null;
  reservedCount: Generated<number>;
  updatedAt: Timestamp | null;
  fcfsEndsAt: string | null;
  fcfsMaxMintPerWallet: number | null;
  fcfsMintPrice: number | null;
  fcfsStartsAt: string | null;
  hasFCFS: Generated<boolean>;
};
export type LaunchItem = {
  id: Generated<string>;
  status: Generated<LAUNCH_ITEM_STATUS>;
  onHoldUntil: Timestamp | null;
  mintingTxId: string | null;
  launchId: string;
  collectibleId: string;
  onHoldBy: string | null;
};
export type Layer = {
  id: Generated<string>;
  name: string;
  layer: Generated<LAYER>;
  network: Generated<NETWORK>;
  currencyId: string;
  chainId: string | null;
  layerType: LAYER_TYPE | null;
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
  feeRate: Generated<number>;
  fundingAddress: string | null;
  fundingAmount: number;
  fundingTxId: string | null;
  privateKey: string | null;
  createdAt: Generated<Timestamp>;
  mintedAt: Timestamp | null;
  orderType: Generated<ORDER_TYPE>;
  orderStatus: Generated<ORDER_STATUS>;
  userId: string;
  userLayerId: string;
  collectionId: string | null;
  launchItemId: string | null;
  purchaseId: string | null;
};
export type OrderItem = {
  id: Generated<string>;
  mintedTxId: string | null;
  createdAt: Generated<Timestamp>;
  type: ORDER_ITEM_TYPE;
  status: Generated<ORDER_ITEM_STATUS>;
  orderId: string;
  collectibleId: string | null;
  traitValueId: string | null;
};
export type Purchase = {
  id: Generated<string>;
  userId: string;
  launchItemId: string;
  purchasedAt: Generated<Timestamp>;
  purchasedAddress: string | null;
};
export type TraitType = {
  id: Generated<string>;
  name: string;
  zIndex: number;
  createdAt: Generated<Timestamp>;
  collectionId: string;
};
export type TraitValue = {
  id: Generated<string>;
  value: string;
  inscriptionId: string | null;
  fileKey: string;
  createdAt: Generated<Timestamp>;
  mintedAt: Timestamp | null;
  lockingAddress: string | null;
  lockingPrivateKey: string | null;
  traitTypeId: string;
};
export type User = {
  id: Generated<string>;
  role: Generated<ROLES>;
  createdAt: Generated<Timestamp>;
};
export type UserLayer = {
  id: Generated<string>;
  address: string;
  pubkey: string | null;
  xpub: string | null;
  createdAt: Generated<Timestamp>;
  isActive: Generated<boolean>;
  deactivatedAt: Timestamp | null;
  userId: string;
  layerId: string;
};
export type WlAddress = {
  id: Generated<string>;
  launchId: string;
  address: string;
  createdAt: Generated<Timestamp>;
  phase: Generated<LAUNCH_PHASE>;
};
export type DB = {
  Airdrop: Airdrop;
  Collectible: Collectible;
  CollectibleTrait: CollectibleTrait;
  Collection: Collection;
  Currency: Currency;
  FailedMint: FailedMint;
  Launch: Launch;
  LaunchItem: LaunchItem;
  Layer: Layer;
  List: List;
  Order: Order;
  OrderItem: OrderItem;
  Purchase: Purchase;
  TraitType: TraitType;
  TraitValue: TraitValue;
  User: User;
  UserLayer: UserLayer;
  WlAddress: WlAddress;
};
