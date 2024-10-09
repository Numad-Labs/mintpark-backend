export const COLLECTIBLE_STATUS = {
  ACTIVE: "ACTIVE",
  ON_HOLD: "ON_HOLD",
  SOLD: "SOLD",
} as const;
export type COLLECTIBLE_STATUS =
  (typeof COLLECTIBLE_STATUS)[keyof typeof COLLECTIBLE_STATUS];
export const COLLECTION_STATUS = {
  LIVE: "LIVE",
  UPCOMING: "UPCOMING",
  PAST: "PAST",
} as const;
export type COLLECTION_STATUS =
  (typeof COLLECTION_STATUS)[keyof typeof COLLECTION_STATUS];
export const ORDER_STATUS = {
  PENDING: "PENDING",
  IN_QUEUE: "IN_QUEUE",
  INSCRIBING: "INSCRIBING",
  INSCRIBED: "INSCRIBED",
  CLOSED: "CLOSED",
} as const;
export type ORDER_STATUS = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
export const TRANSACTION_STATUS = {
  TRANSACTION_UNCONFIRMED: "TRANSACTION_UNCONFIRMED",
  TRANSACION_CONFIRMED: "TRANSACION_CONFIRMED",
  TRANSACTION_FAILED: "TRANSACTION_FAILED",
} as const;
export type TRANSACTION_STATUS =
  (typeof TRANSACTION_STATUS)[keyof typeof TRANSACTION_STATUS];
export const MINTING_TYPE = {
  COLLECTIBLE: "COLLECTIBLE",
  BRC20: "BRC20",
  COLLECTION: "COLLECTION",
} as const;
export type MINTING_TYPE = (typeof MINTING_TYPE)[keyof typeof MINTING_TYPE];
export const LAYER_TYPE = {
  FRACTAL: "FRACTAL",
  BITCOIN: "BITCOIN",
  ETHEREUM: "ETHEREUM",
  COORDINATE: "COORDINATE",
  FRACTAL_TESTNET: "FRACTAL_TESTNET",
  BITCOIN_TESTNET: "BITCOIN_TESTNET",
  ETHEREUM_TESTNET: "ETHEREUM_TESTNET",
  COORDINATE_TESTNET: "COORDINATE_TESTNET",
} as const;
export type LAYER_TYPE = (typeof LAYER_TYPE)[keyof typeof LAYER_TYPE];
