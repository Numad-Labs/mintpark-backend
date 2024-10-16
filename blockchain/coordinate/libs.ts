import * as coordinate from "chromajs-lib";
import axios, { AxiosError } from "axios";
import { utxo } from "../../custom";
import { config } from "../../src/config/config";
import { CustomError } from "../../src/exceptions/CustomError";
import {
  TX_INPUT_P2PKH,
  TX_INPUT_P2SH,
  TX_INPUT_P2TR,
  TX_INPUT_P2WPKH,
  TX_OUTPUT_P2PKH,
  TX_OUTPUT_P2SH,
  TX_OUTPUT_P2TR,
  TX_OUTPUT_P2WPKH,
} from "../constants";

export async function getUtxos(address: string | null, xpub: string | null) {
  let response;
  if (address) {
    response = await axios.get(
      `http://btc-testnet-wallet.mara.technology:9130/unspents/list?xpub=&address=${address}&page_no=1&limit=25`
    );
  } else if (xpub) {
    response = await axios.get(
      `http://btc-testnet-wallet.mara.technology:9130/unspents/list?xpub=${xpub}&address=&page_no=1&limit=25`
    );
  } else {
    throw new CustomError("Please provide either xpub or address.", 400);
  }

  const utxos: utxo[] = response.data.result;

  utxos.forEach((utxo) => {
    utxo.value = Number(utxo.value);
    utxo.height = Number(utxo.height);
  });
  utxos.sort((a, b) => b.value - a.value);

  return utxos;
}

export async function checkTransactionStatus(txid: string) {
  const rpcPayload = {
    jsonrpc: "2.0",
    id: "check-tx",
    method: "getrawtransaction",
    params: [txid, true],
  };

  try {
    const response = await axios.post(config.COORDINATE_URL, rpcPayload, {
      auth: {
        username: config.COORDINATE_USER,
        password: config.COORDINATE_PASSWORD,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.data.error) {
      if (response.data.error.code === -5) {
        return { broadcasted: false, inMempool: false, confirmations: 0 };
      }
      throw new Error(response.data.error.message);
    }

    const result = response.data.result;
    const confirmations = result.confirmations || 0;
    const inMempool = confirmations === 0;

    return {
      broadcasted: true,
      inMempool,
      confirmations,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        return { broadcasted: false, inMempool: false, confirmations: 0 };
      }
      throw new Error(`Network error: ${axiosError.message}`);
    }
    throw error;
  }
}

export function createPayment(address: string): coordinate.Payment | undefined {
  const NETWORK = coordinate.networks.testnet;
  const type = getAddressType(address);

  switch (type.script) {
    case "p2pkh":
      return coordinate.payments.p2pkh({ address, network: NETWORK });
    case "p2sh":
      return coordinate.payments.p2sh({ address, network: NETWORK });
    case "p2wpkh":
      return coordinate.payments.p2wpkh({ address, network: NETWORK });
    case "p2tr":
      return coordinate.payments.p2tr({ address, network: NETWORK });
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
