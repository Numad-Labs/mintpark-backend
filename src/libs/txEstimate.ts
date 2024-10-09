import * as bitcoin from "bitcoinjs-lib";

const TX_EMPTY_SIZE = 4 + 1 + 1 + 4;
const TX_INPUT_BASE = 32 + 4 + 1 + 4;
const TX_INPUT_PUBKEYHASH = 107;
const TX_INPUT_SEGWIT = 27;
const TX_INPUT_TAPROOT = 17;
const TX_OUTPUT_BASE = 8 + 1;
const TX_OUTPUT_PUBKEYHASH = 25;
const TX_OUTPUT_SCRIPTHASH = 23;
const TX_OUTPUT_SEGWIT = 22;
const TX_OUTPUT_SEGWIT_SCRIPTHASH = 34;
const WITNESS_SCALE_FACTOR = 4;

function getAddressType(
  address: string,
): string {
  try {
    if (address.startsWith("bc1p") || address.startsWith("tb1p")) {
      return "p2tr";
    } else if (address.startsWith("bc1") || address.startsWith("tb1")) {
      return address.length === 42 ? "p2wpkh" : "p2wsh";
    } else if (
      address.startsWith("1") ||
      address.startsWith("m") ||
      address.startsWith("n")
    ) {
      return "p2pkh";
    } else if (address.startsWith("3") || address.startsWith("2")) {
      return "p2sh";
    } else {
      throw new Error("Unknown address type");
    }
  } catch (error) {
    console.error("Invalid address:", error);
    return "unknown";
  }
}

function inputBytes(addressType: string): number {
  switch (addressType) {
    case "p2tr":
      return TX_INPUT_BASE + TX_INPUT_TAPROOT;
    case "p2wpkh":
    case "p2wsh":
      return TX_INPUT_BASE + TX_INPUT_SEGWIT;
    case "p2pkh":
    case "p2sh":
    default:
      return TX_INPUT_BASE + TX_INPUT_PUBKEYHASH;
  }
}

function outputBytes(addressType: string): number {
  switch (addressType) {
    case "p2tr":
      return TX_OUTPUT_BASE + TX_OUTPUT_SEGWIT_SCRIPTHASH; // Use this for Taproot outputs
    case "p2wpkh":
      return TX_OUTPUT_BASE + TX_OUTPUT_SEGWIT;
    case "p2wsh":
      return TX_OUTPUT_BASE + TX_OUTPUT_SEGWIT_SCRIPTHASH;
    case "p2sh":
      return TX_OUTPUT_BASE + TX_OUTPUT_SCRIPTHASH;
    case "p2pkh":
    default:
      return TX_OUTPUT_BASE + TX_OUTPUT_PUBKEYHASH;
  }
}

export function calculateTransactionSize(
  inputs: { address: string; count: number }[],
  outputs: { address: string; count: number }[],
  inscriptionSize: number = 0,
  isRevealTx: boolean = false
): number {
  const inputSize = inputs.reduce((sum, input) => {
    const addressType = getAddressType(input.address);
    return sum + input.count * inputBytes(addressType);
  }, 0);

  const outputSize = outputs.reduce((sum, output) => {
    const addressType = getAddressType(output.address);
    return sum + output.count * outputBytes(addressType);
  }, 0);

  let totalSize = TX_EMPTY_SIZE + inputSize + outputSize;

  // Add extra buffer for reveal transaction
  if (isRevealTx) {
    totalSize += Math.ceil(inscriptionSize / WITNESS_SCALE_FACTOR);
    totalSize += 10; // Extra buffer for reveal transaction
  }
  return totalSize;
}
