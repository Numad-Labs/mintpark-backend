import axios, { AxiosError } from "axios";
import logger from "../../config/winston";
import { mempoolUtxo } from "../../../custom";
import { CustomError } from "../../exceptions/CustomError";
import {
  DUST_THRESHOLD,
  TX_INPUT_P2TR,
  WITNESS_SCALE_FACTOR,
  TX_OUTPUT_P2TR,
  TX_EMPTY_SIZE,
} from "./constants";

export async function getBalance(address: string) {
  const response = await axios.get(
    `https://mempool.space/testnet4/api/address/${address}`,
    {
      headers: {
        accept: "application/json",
      },
    }
  );

  logger.info(`bitcoin getBalance: ${response.data}, ${new Date()}`);

  const confirmedBalance = Number(response.data.chain_stats.funded_txo_sum);
  const unconfirmedBalance = Number(response.data.mempool_stats.funded_txo_sum);

  return confirmedBalance + unconfirmedBalance;
}

export async function getUtxos(address: string) {
  const response = await axios.get(
    `https://mempool.space/testnet4/api/address/${address}/utxo`,
    {
      headers: {
        accept: "application/json",
      },
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

function calculateInscriptionSize(
  fileSize: number,
  mimeTypeByteSize: number
): number {
  return Math.ceil(
    (33 + // Internal pubkey
      1 + // OP_CHECKSIG
      1 + // OP_FALSE
      1 + // OP_IF
      4 + // OP_PUSH(3) + "ord"
      2 + // OP_PUSH(1) + version
      1 + // OP_PUSH(mime type length)
      mimeTypeByteSize +
      2 + // OP_PUSH(file size)
      Math.ceil(fileSize / 520) + // Number of 520-byte chunks
      fileSize +
      1 + // OP_ENDIF
      10) / // Tapscript overhead
      WITNESS_SCALE_FACTOR
  );
}

export function getEstimatedFee(
  fileSize: number[],
  mimeTypeByteSize: number[],
  serviceFee: number,
  feeRate: number,
  price: number = 0
) {
  const dustLimit = DUST_THRESHOLD;
  if (fileSize.length !== mimeTypeByteSize.length) {
    throw new Error(
      "File size array and file type size array must have same length."
    );
  }

  let totalAmount = 0;
  let totalCommitFee = 0;
  let totalRevealFee = 0;
  let totalServiceFee = serviceFee * fileSize.length;

  for (let i = 0; i < fileSize.length; i++) {
    const commitInputSize = TX_INPUT_P2TR * 1; // Assuming 1 input
    const commitOutputSize =
      price > 0 ? TX_OUTPUT_P2TR * 3 : TX_OUTPUT_P2TR * 2; // Reveal output + change (+ price output if applicable)
    const commitSize = commitInputSize + commitOutputSize + TX_EMPTY_SIZE;

    const inscriptionSize = calculateInscriptionSize(
      fileSize[i],
      mimeTypeByteSize[i]
    );
    const revealSize = Math.ceil(
      TX_EMPTY_SIZE * 1 +
        TX_INPUT_P2TR * 1 +
        TX_OUTPUT_P2TR * 1 +
        inscriptionSize
    );
    const commitFee = commitSize * feeRate;
    const revealFee = revealSize * feeRate;
    totalCommitFee += commitFee;
    totalRevealFee += revealFee;
    totalAmount += commitFee + revealFee;
  }
  totalAmount += price + totalServiceFee + dustLimit * fileSize.length;
  return {
    estimatedFee: {
      feeRate: feeRate,
      price: price,
      networkFee: totalAmount - price - totalServiceFee,
      serviceFee: totalServiceFee,
      commitFee: totalCommitFee,
      revealFee: totalRevealFee,
      totalAmount: totalAmount,
    },
  };
}
