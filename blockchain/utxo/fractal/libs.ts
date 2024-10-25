import axios, { AxiosError } from "axios";
import { CustomError } from "../../../src/exceptions/CustomError";
import { unisatUtxo } from "../../../custom";
import { config } from "../../../src/config/config";
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

export async function getUtxos(address: string, isTestNet: boolean = true) {
  const baseUrl = isTestNet
    ? "https://open-api-fractal-testnet.unisat.io/v1"
    : "https://open-api-fractal.unisat.io/v1";
  const response = await axios.get(
    `${baseUrl}/indexer/address/${address}/utxo-data`,
    {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${config.UNISAT_FRACTAL_TESTNET_API_KEY}`,
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

export async function getRawTransaction(
  txid: string,
  isTestNet: boolean = true
) {
  const baseUrl = isTestNet
    ? "https://open-api-fractal-testnet.unisat.io/v1"
    : "https://open-api-fractal.unisat.io/v1";
  const response = await axios.get(`${baseUrl}/indexer/rawtx/${txid}`, {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${config.UNISAT_FRACTAL_TESTNET_API_KEY}`,
    },
  });
  return response.data.data;
}

export async function getInscriptionUtxosByAddress(
  address: string,
  isTestNet: boolean = true
) {
  const baseUrl = isTestNet
    ? "https://open-api-fractal-testnet.unisat.io/v1"
    : "https://open-api-fractal.unisat.io/v1";
  const response = await axios.get(
    `${baseUrl}/indexer/address/${address}/inscription-utxo-data`,
    {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${config.UNISAT_FRACTAL_TESTNET_API_KEY}`,
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

export async function getInscriptionInfo(
  inscriptionId: string,
  isTestNet: boolean = true
) {
  const baseUrl = isTestNet
    ? "https://open-api-fractal-testnet.unisat.io/v1"
    : "https://open-api-fractal.unisat.io/v1";
  const response = await axios.get(
    `${baseUrl}/indexer/inscription/info/${inscriptionId}`,
    {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${config.UNISAT_FRACTAL_TESTNET_API_KEY}`,
      },
    }
  );

  return response.data.data;
}

export function prepareInputs(
  utxos: unisatUtxo[],
  requiredAmount: number,
  inputSize: number,
  feeRate: number
) {
  let totalAmount = 0;
  let index = 0;
  const inputs: unisatUtxo[] = [];

  while (totalAmount < requiredAmount) {
    if (index > utxos.length - 1) throw new Error("Insufficient balance.");

    inputs.push(utxos[index]);
    totalAmount += utxos[index].satoshi;

    index++;
    requiredAmount += inputSize * feeRate;
  }

  return {
    inputs: inputs,
    changeAmount: totalAmount - requiredAmount,
  };
}

export async function checkTransactionStatus(txid: string) {
  const rpcPayload = {
    jsonrpc: "2.0",
    id: "check-tx",
    method: "getrawtransaction",
    params: [txid, true],
  };

  try {
    const response = await axios.post(config.FRACTAL_TESTNET_URL, rpcPayload, {
      auth: {
        username: config.FRACTAL_TESTNET_USER,
        password: config.FRACTAL_TESTNET_PASSWORD,
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
  } else if (address.startsWith("tb1q") || address.startsWith("bc1q")) {
    return {
      script: "p2wpkh",
      inputSize: TX_INPUT_P2WPKH,
      outputSize: TX_OUTPUT_P2WPKH,
    };
  } else if (address.startsWith("tb1p") || address.startsWith("bc1p")) {
    return {
      script: "p2tr",
      inputSize: TX_INPUT_P2TR,
      outputSize: TX_OUTPUT_P2TR,
    };
  } else {
    throw new Error("Unsupported address format");
  }
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

export async function sendRawTransactionWithNode(
  rawTx: string,
  isTestNet: boolean = true
) {
  const baseUrl = isTestNet
    ? `http://${config.FRACTAL_TESTNET_URL}`
    : `http://${config.FRACTAL_MAINNET_URL}`;

  const body = {
    jsonrpc: "1.0",
    method: "sendrawtransaction",
    id: "sendrawtransaction",
    params: [rawTx],
  };

  try {
    const response = await axios.post(baseUrl, body, {
      auth: {
        username: config.FRACTAL_TESTNET_USER,
        password: config.FRACTAL_TESTNET_PASSWORD,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data.result;
  } catch (error) {
    throw error;
  }
}
