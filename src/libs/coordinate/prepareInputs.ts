import { getUtxos } from "./libs";
import { utxo } from "../../../custom";
import { CustomError } from "../../exceptions/CustomError";

export async function prepareInputs(
  address: string | null,
  xpub: string | null,
  requiredAmount: number,
  inputSize: number,
  feeRate: number
) {
  let utxos: utxo[];
  const inputs: utxo[] = [];
  let totalAmount = 0,
    index = 0;

  if (address) {
    utxos = await getUtxos(address, null);
  } else if (xpub) {
    utxos = await getUtxos(null, xpub);
  } else {
    throw new CustomError("Please provide either xpub or address.", 400);
  }

  while (totalAmount < requiredAmount) {
    if (index > utxos.length - 1) throw new Error("Insufficient balance.");

    inputs.push(utxos[index]);
    totalAmount += utxos[index].value;

    index++;
    requiredAmount += inputSize * feeRate;
  }

  return {
    inputs: inputs,
    changeAmount: totalAmount - requiredAmount,
  };
}
