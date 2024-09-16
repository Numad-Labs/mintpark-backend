import * as coordinate from "chromajs-lib";
import { tokenData } from "../../../custom";

const schnorr = require("bip-schnorr");
const convert = schnorr.convert;
import * as ecc from "tiny-secp256k1";
import * as bip39 from "bip39";
import { BIP32Factory } from "bip32";
import {
  createPayment,
  getAddressType,
  getUtxos,
  TX_INPUT_P2WPKH,
  TX_OUTPUT_P2WPKH,
} from "./libs";
import { prepareInputs } from "./prepareInputs";
import { CustomError } from "../../exceptions/CustomError";
const bip32 = BIP32Factory(ecc);

export const BASE_TX_SIZE = 10 + 32 + 50 + 7 + 8;

export async function mint(
  data: tokenData,
  toAddress: string,
  price: number,
  feeRate: number
) {
  if (!data.address)
    throw new CustomError("Please provide either address.", 400);
  const address = data.address;
  const type = getAddressType(address);

  const opreturnData = JSON.stringify(data.opReturnValues);
  const payloadHex = convertDataToSha256Hex(opreturnData);

  const psbt = new coordinate.Psbt({
    network: coordinate.networks.testnet,
  });
  psbt.setVersion(10);
  psbt.assettype = data.assetType;
  psbt.headline = stringToHex(data.headline);
  psbt.ticker = stringToHex(data.ticker);
  psbt.payload = payloadHex;
  psbt.payloaddata = stringToHex(opreturnData);
  if (data.assetType === 0) psbt.setPrecisionType(8);

  const payloadSize = calculateByteSize(data.opReturnValues);
  const requiredAmount =
    (BASE_TX_SIZE + payloadSize + type.outputSize * 4) * feeRate + price;

  const { inputs, changeAmount } = await prepareInputs(
    address,
    null,
    requiredAmount,
    type.inputSize,
    feeRate
  );

  inputs.forEach((input) => {
    const payment = createPayment(address);

    if (!payment?.output) {
      throw new Error("Could not generate output script");
    }

    psbt.addInput({
      hash: input.txid,
      index: input.vout,
      witnessUtxo: {
        script: payment.output,
        value: input.value,
      },
    });
  });

  psbt.addOutput({ address: address, value: 10 ** 8 });
  psbt.addOutput({ address: address, value: data.supply });
  psbt.addOutput({ address: toAddress, value: price });

  if (changeAmount >= 546)
    psbt.addOutput({ address: address, value: changeAmount });

  const txId = getUnsignedPsbtTxid(psbt);
  console.log(txId);

  return { hex: psbt.toHex(), txId: txId };
}

export async function mintForAnduroWallet(
  data: tokenData,
  toAddress: string,
  price: number,
  feeRate: number
) {
  if (!data.xpub) throw new CustomError("Please provide either xpub.", 400);

  const node = bip32.fromBase58(data.xpub, coordinate.networks.testnet);

  const opreturnData = JSON.stringify(data.opReturnValues);
  const payloadHex = convertDataToSha256Hex(opreturnData);

  const psbt = new coordinate.Psbt({
    network: coordinate.networks.testnet,
  });
  psbt.setVersion(10);
  psbt.assettype = data.assetType;
  psbt.headline = stringToHex(data.headline);
  psbt.ticker = stringToHex(data.ticker);
  psbt.payload = payloadHex;
  psbt.payloaddata = stringToHex(opreturnData);
  if (data.assetType === 0) psbt.setPrecisionType(8);

  const payloadSize = calculateByteSize(data.opReturnValues);
  const requiredAmount =
    (BASE_TX_SIZE + payloadSize + TX_OUTPUT_P2WPKH * 4) * feeRate + price;

  const { inputs, changeAmount } = await prepareInputs(
    null,
    data.xpub,
    requiredAmount,
    TX_INPUT_P2WPKH,
    feeRate
  );

  inputs.forEach((input) => {
    // const payment = createPayment(data.address);

    const childNode = node.derive(input.derviation_index);
    const payment = coordinate.payments.p2wpkh({
      pubkey: childNode.publicKey,
      network: coordinate.networks.testnet,
    });

    if (!payment?.output) {
      throw new Error("Could not generate output script");
    }

    psbt.addInput({
      hash: input.txid,
      index: input.vout,
      witnessUtxo: {
        script: payment.output,
        value: input.value,
      },
    });
  });

  const controllerNode = node.derive(0);
  const controllerAddress = coordinate.payments.p2wpkh({
    pubkey: controllerNode.publicKey,
    network: coordinate.networks.testnet,
  }).address!;

  psbt.addOutput({ address: controllerAddress, value: 10 ** 8 });
  psbt.addOutput({ address: controllerAddress, value: data.supply });
  psbt.addOutput({ address: toAddress, value: price });

  if (changeAmount >= 546)
    psbt.addOutput({ address: controllerAddress, value: changeAmount });

  const txId = getUnsignedPsbtTxid(psbt);
  console.log(txId);

  return { hex: psbt.toHex(), txId: txId };
}

export function getUnsignedPsbtTxid(psbt: coordinate.Psbt): string {
  const tx = new coordinate.Transaction();
  tx.version = psbt.version;

  psbt.data.inputs.forEach((psbInput, index) => {
    if (!psbInput.witnessUtxo && !psbInput.nonWitnessUtxo) {
      throw new Error(`Input ${index} is missing UTXO information`);
    }

    const txInput = psbt.txInputs[index];

    const hash = psbInput.witnessUtxo
      ? txInput.hash
      : coordinate.crypto.hash256(psbInput.nonWitnessUtxo!).reverse();

    tx.addInput(hash, txInput.index, txInput.sequence);
  });

  psbt.txOutputs.forEach((output) => {
    tx.addOutput(output.script, output.value);
  });

  tx.locktime = psbt.locktime;

  return tx.getId();
}

export function calculateByteSize(data: any): number {
  const opReturnData = JSON.stringify(data);
  return Buffer.byteLength(opReturnData, "utf8");
}

export function convertDataToSha256Hex(value: string | Buffer): string {
  if (value == null) {
    throw new Error("Input value cannot be null or undefined");
  }

  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return convert.hash(buffer).toString("hex");
}

export function stringToHex(value: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Input must be a non-empty string");
  }

  return Buffer.from(value, "utf8").toString("hex");
}
