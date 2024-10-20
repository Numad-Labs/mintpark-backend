export const fileSizeLimit = 37748736; //36MB

export const TX_INPUT_P2PKH = 148;
export const TX_INPUT_P2SH = 91;
export const TX_INPUT_P2WPKH = 68;
export const TX_INPUT_P2TR = 58;
export const TX_OUTPUT_P2PKH = 34;
export const TX_OUTPUT_P2SH = 32;
export const TX_OUTPUT_P2WPKH = 31;
export const TX_OUTPUT_P2TR = 43;
export const TX_EMPTY_SIZE = 10;
export const WITNESS_SCALE_FACTOR = 3;
export const DUST_THRESHOLD = 546;

export const ASSETTYPE = {
  TOKEN: 0,
  NFTOFFCHAIN: 1,
  NFTONCHAIN: 2,
};

export const SERVICE_FEE_ADDRESS = {
  BITCOIN: {
    MAINNET: "",
    TESTNET: "tb1pffk5397d7sns6mayud03nf3fxy4p04e3alhslr6epaq3a788tsuqpw7qeu",
  },

  FRACTAL: {
    MAINNET: "",
    TESTNET: "bc1qzr9zqc5d7zj7ktxnfdeueqmxwfwdvrmedckckd",
  },

  CITREA: {
    MAINNET: "",
    TESTNET: "",
  },
};

export const SERVICE_FEE = {
  BITCOIN: {
    MAINNET: 500,
    TESTNET: 696,
  },

  FRACTAL: {
    MAINNET: 500,
    TESTNET: 696,
  },

  CITREA: {
    MAINNET: 500,
    TESTNET: 696,
  },
};

export const DEFAULT_FEE_RATE = 1;

export const MAX_SATOSHI_AMOUNT = 2_100_000_000_000_000;
