import axios, { AxiosError } from "axios";
import logger from "../../config/winston";
import { mempoolUtxo } from "../../../custom";
import { CustomError } from "../../exceptions/CustomError";

export async function getBalance(address: string) {
  const response = await axios.get(
    `https://mempool.space/testnet4/api/address/${address}`,
    {
      headers: {
        accept: "application/json"
      }
    }
  );

  logger.info(`bitcoin getBalance: ${response.data}, ${new Date()}`);

  const confirmedBalance = Number(response.data.chain_stats.funded_txo_sum);
  const unconfirmedBalance = Number(response.data.mempool_stats.funded_txo_sum);

  return confirmedBalance + unconfirmedBalance;
}

export async function getBlockHeight() {
  const response = await axios.get(
    `https://mempool.space/testnet4/api/block/:hash`,
    {
      headers: {
        accept: "application/json"
      }
    }
  );

  return response.data.height;
}

export async function getUtxos(address: string) {
  const response = await axios.get(
    `https://mempool.space/testnet4/api/address/${address}/utxo`,
    {
      headers: {
        accept: "application/json"
      }
    }
  );

  const utxos: mempoolUtxo[] = response.data;

  logger.info(`bitcoin getUtxos: ${utxos}, ${new Date()}`);

  return utxos;
}

export function selectUtxos(
  utxos: mempoolUtxo[],
  requiredAmountInSatoshi: number
) {
  const sortedUTXOs = utxos.sort((a, b) => Number(b.value - a.value));

  const selectedUtxos: mempoolUtxo[] = [];
  let totalAmount = 0;
  for (const utxo of sortedUTXOs) {
    totalAmount += utxo.value;
    selectedUtxos.push(utxo);

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

export function isBitcoinTestnetAddress(address: string) {
  if (!address || typeof address !== "string") {
    throw new Error("Invalid Bitcoin address");
  }

  // Legacy addresses (P2PKH)
  if (address.startsWith("1")) {
    return false;
  }
  if (address.startsWith("m") || address.startsWith("n")) {
    return true;
  }

  // P2SH addresses
  if (address.startsWith("3")) {
    return false;
  }
  if (address.startsWith("2")) {
    return true;
  }

  if (address.startsWith("bc1")) {
    return false;
  }
  if (address.startsWith("tb1")) {
    return true;
  }

  throw new Error("Invalid Bitcoin address format");
}
