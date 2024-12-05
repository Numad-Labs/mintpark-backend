export const ORDER_TYPE = {
  MINT: "MINT",
  LAUNCH_BUY: "LAUNCH_BUY",
} as const;
export type ORDER_TYPE = (typeof ORDER_TYPE)[keyof typeof ORDER_TYPE];
export const ORDER_STATUS = {
  PENDING: "PENDING",
  IN_QUEUE: "IN_QUEUE",
  DONE: "DONE",
  EXPIRED: "EXPIRED",
} as const;
export type ORDER_STATUS = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
export const ORDER_ITEM_STATUS = {
  PENDING: "PENDING",
  IN_QUEUE: "IN_QUEUE",
  MINTING: "MINTING",
  MINTED: "MINTED",
  FAILED: "FAILED",
} as const;
export type ORDER_ITEM_STATUS =
  (typeof ORDER_ITEM_STATUS)[keyof typeof ORDER_ITEM_STATUS];
export const COLLECTION_STATUS = {
  UNCONFIRMED: "UNCONFIRMED",
  CONFIRMED: "CONFIRMED",
} as const;
export type COLLECTION_STATUS =
  (typeof COLLECTION_STATUS)[keyof typeof COLLECTION_STATUS];
export const COLLECTION_TYPE = {
  INSCRIPTION: "INSCRIPTION",
  RECURSIVE_INSCRIPTION: "RECURSIVE_INSCRIPTION",
  IPFS: "IPFS",
  SYNTHETIC: "SYNTHETIC",
} as const;
export type COLLECTION_TYPE =
  (typeof COLLECTION_TYPE)[keyof typeof COLLECTION_TYPE];
export const COLLECTIBLE_STATUS = {
  UNCONFIRMED: "UNCONFIRMED",
  CONFIRMED: "CONFIRMED",
  BURNED: "BURNED",
  LOCKED: "LOCKED",
} as const;
export type COLLECTIBLE_STATUS =
  (typeof COLLECTIBLE_STATUS)[keyof typeof COLLECTIBLE_STATUS];
export const LAUNCH_ITEM_STATUS = {
  ACTIVE: "ACTIVE",
  SOLD: "SOLD",
  CANCELLED: "CANCELLED",
} as const;
export type LAUNCH_ITEM_STATUS =
  (typeof LAUNCH_ITEM_STATUS)[keyof typeof LAUNCH_ITEM_STATUS];
export const LIST_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  SOLD: "SOLD",
  CANCELLED: "CANCELLED",
} as const;
export type LIST_STATUS = (typeof LIST_STATUS)[keyof typeof LIST_STATUS];
export const LAYER = {
  BITCOIN: "BITCOIN",
  FRACTAL: "FRACTAL",
  CITREA: "CITREA",
} as const;
export type LAYER = (typeof LAYER)[keyof typeof LAYER];
export const NETWORK = {
  MAINNET: "MAINNET",
  TESTNET: "TESTNET",
} as const;
export type NETWORK = (typeof NETWORK)[keyof typeof NETWORK];
export const ROLES = {
  USER: "USER",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;
export type ROLES = (typeof ROLES)[keyof typeof ROLES];
