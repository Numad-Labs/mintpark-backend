export const ORDER_TYPE = {
  TOKEN: "TOKEN",
  COLLECTIBLE: "COLLECTIBLE",
  COLLECTION: "COLLECTION",
  LAUNCH: "LAUNCH",
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
export const COLLECTION_TYPE = {
  UNCONFIRMED: "UNCONFIRMED",
  LAUNCHED: "LAUNCHED",
  MINTED: "MINTED",
} as const;
export type COLLECTION_TYPE =
  (typeof COLLECTION_TYPE)[keyof typeof COLLECTION_TYPE];
export const LIST_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  SOLD: "SOLD",
  CANCELLED: "CANCELLED",
} as const;
export type LIST_STATUS = (typeof LIST_STATUS)[keyof typeof LIST_STATUS];
export const LAUNCH_ITEM_STATUS = {
  ACTIVE: "ACTIVE",
  SOLD: "SOLD",
  CANCELLED: "CANCELLED",
} as const;
export type LAUNCH_ITEM_STATUS =
  (typeof LAUNCH_ITEM_STATUS)[keyof typeof LAUNCH_ITEM_STATUS];
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
