import axios, { AxiosError } from "axios";
import { unisatBitcoinTestnetApi } from "../constants";
import { unisatUtxo } from "../../../custom";
import * as bitcoin from "bitcoinjs-lib";
import { CustomError } from "../../exceptions/CustomError";

type AddressType = "p2pkh" | "p2sh" | "p2wpkh" | "p2tr";

export const TX_INPUT_P2PKH = 148;
export const TX_INPUT_P2SH = 91;
export const TX_INPUT_P2WPKH = 68;
export const TX_INPUT_P2TR = 58;
export const TX_OUTPUT_P2PKH = 34;
export const TX_OUTPUT_P2SH = 32;
export const TX_OUTPUT_P2WPKH = 31;
export const TX_OUTPUT_P2TR = 43;
export const TX_EMPTY_SIZE = 10;
export const WITNESS_SCALE_FACTOR = 4;

export async function getUtxosWithAddress(
  address: string,
  network?: bitcoin.networks.Network
) {
  const baseUrl =
    network === bitcoin.networks.testnet
      ? "https://open-api-testnet.unisat.io/v1"
      : "https://open-api-s1.unisat.io/v1";
  const response = await axios.get(
    `${baseUrl}/indexer/address/${address}/utxo-data`,
    {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${unisatBitcoinTestnetApi}`,
      },
    }
  );
  const utxos: unisatUtxo[] = response.data.data.utxo;
  utxos.forEach((utxo) => {
    utxo.satoshi = Number(utxo.satoshi);
    utxo.height = Number(utxo.height);
  });
  utxos.sort((a, b) => b.satoshi - a.satoshi);

  return utxos;
}

export function selectUtxos(
  utxos: unisatUtxo[],
  requiredAmountInSatoshi: number
) {
  const sortedUTXOs = utxos.sort((a, b) => Number(b.satoshi - a.satoshi));

  const selectedUtxos: unisatUtxo[] = [];
  let totalAmount = 0;
  for (const utxo of sortedUTXOs) {
    if (!utxo.isSpent) {
      totalAmount += utxo.satoshi;
      selectedUtxos.push(utxo);
    }
    if (totalAmount >= requiredAmountInSatoshi) {
      break;
    }
  }
  console.log({ totalAmount, requiredAmountInSatoshi });
  if (totalAmount < requiredAmountInSatoshi) {
    throw new CustomError("Insufficient balance", 400);
  }
  return selectedUtxos;
}

export function deriveAddressFromPublicKey(
  publicKey: Buffer,
  network: bitcoin.Network = bitcoin.networks.testnet
): string {
  const { address } = bitcoin.payments.p2tr({
    internalPubkey: publicKey.slice(1, 33), // Convert to x-only public key
    network: network,
  });
  return address!;
}

export function calculateUnsignedSegwitTxid(psbt: bitcoin.Psbt): string {
  const tx = new bitcoin.Transaction();

  // Set version
  tx.version = psbt.version;

  // Add inputs (without witnesses)
  psbt.txInputs.forEach((input, index) => {
    if (!input.hash || input.index === undefined) {
      throw new Error(`Missing hash or index for input ${index}`);
    }
    const hash = Buffer.isBuffer(input.hash)
      ? input.hash
      : Buffer.from(input.hash, "hex").reverse();
    tx.addInput(hash, input.index, input.sequence);
  });

  // Add outputs
  psbt.txOutputs.forEach((output, index) => {
    if (!output.script || output.value === undefined) {
      throw new Error(`Missing script or value for output ${index}`);
    }
    tx.addOutput(output.script, output.value);
  });

  // For SegWit transactions, we calculate the txid without the witness data
  return tx.getHash().reverse().toString("hex");
}

export function createPayment(
  address: string,
  network: bitcoin.Network = bitcoin.networks.testnet
): bitcoin.Payment | undefined {
  const NETWORK = network;
  const type = getAddressType(address);

  switch (type.script) {
    case "p2pkh":
      return bitcoin.payments.p2pkh({ address, network: NETWORK });
    case "p2sh":
      return bitcoin.payments.p2sh({ address, network: NETWORK });
    case "p2wpkh":
      return bitcoin.payments.p2wpkh({ address, network: NETWORK });
    case "p2tr":
      return bitcoin.payments.p2tr({ address, network: NETWORK });
  }
}

export function getAddressType(address: string) {
  if (
    address.startsWith("1") ||
    address.startsWith("m") ||
    address.startsWith("n")
  ) {
    return {
      script: "p2pkh",
      inputSize: TX_INPUT_P2PKH,
      outputSize: TX_OUTPUT_P2PKH,
    };
  } else if (address.startsWith("3") || address.startsWith("2")) {
    return {
      script: "p2sh",
      inputSize: TX_INPUT_P2SH,
      outputSize: TX_OUTPUT_P2SH,
    };
  } else if (address.startsWith("tc1q") || address.startsWith("cc1q")) {
    return {
      script: "p2wpkh",
      inputSize: TX_INPUT_P2WPKH,
      outputSize: TX_OUTPUT_P2WPKH,
    };
  } else if (address.startsWith("tc1p") || address.startsWith("cc1p")) {
    return {
      script: "p2tr",
      inputSize: TX_INPUT_P2TR,
      outputSize: TX_OUTPUT_P2TR,
    };
  } else {
    throw new Error("Unsupported address format");
  }
}
export async function getRecommendedFeeRateBTCTestnet() {
  try {
    // Using mempool.space API for testnet
    const response = await axios.get(
      "https://mempool.space/testnet/api/v1/fees/recommended"
    );

    // The API returns fee estimates for different priorities
    const fee: number = response.data.hourFee;

    // You can choose which fee rate to use based on your priority
    // For this example, we'll use the halfHourFee
    return fee;
  } catch (error) {
    console.error("Error fetching fee estimates:", error);
    // Return a default fee rate if the API call fails
    return 10; // satoshis per vbyte
  }
}
