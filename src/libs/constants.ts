export const intervalMap: { [key: string]: number } = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export const MINIMUM_LISTING_SERVICE_FEE = 10000;
export const LISTING_SERVICE_FEE_PERCENTAGE = 0.02;

export const BADGE_BATCH_SIZE = 25;

export const ON_HOLD_MINUTES = 3;

export const FILE_SIZE_LIMIT = 37748736; //36MB
export const FILE_COUNT_LIMIT = 10;

export const REDIS_KEYS = {
  CONFIG: "upload:config",
  COLLECTION_PREFIX: "upload:collection:",
  getCollectionKey: (collectionId: string) =>
    `upload:collection:${collectionId}`,
  BITCOIN_FEE_RATES: "bitcoin_mempool_feerate",
};

export const sizeLimitConstants = {
  jsonSizeLimit: 5 * 1024 * 1024, //5MB
  formDataSizeLimit: "40mb",
};
