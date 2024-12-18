export const TX_INPUT_P2PKH = 148;
export const TX_INPUT_P2SH = 91;
export const TX_INPUT_P2WPKH = 68;
export const TX_INPUT_P2TR = 58;
export const TX_OUTPUT_P2PKH = 34;
export const TX_OUTPUT_P2SH = 32;
export const TX_OUTPUT_P2WPKH = 31;
export const TX_OUTPUT_P2TR = 43;
export const TX_EMPTY_SIZE = 10;
export const WITNESS_SCALE_FACTOR = 1;
export const DUST_THRESHOLD = 546;

export const DEFAULT_FEE_RATE = 1;

export const MAX_SATOSHI_AMOUNT = 2_100_000_000_000_000;

export const COMMIT_TX_SIZE = TX_INPUT_P2TR + TX_OUTPUT_P2TR * 2;
export const REVEAL_TX_SIZE = TX_INPUT_P2TR + TX_OUTPUT_P2TR * 2;
