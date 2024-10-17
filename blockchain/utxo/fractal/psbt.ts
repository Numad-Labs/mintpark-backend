import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { CustomError } from "../../../src/exceptions/CustomError";
import { unisatUtxo } from "../../../custom";
import {
  getAddressType,
  getRawTransaction,
  getUtxos,
  prepareInputs,
} from "./libs";
import { TX_EMPTY_SIZE } from "../constants";

bitcoin.initEccLib(ecc);

export async function transferFund(
  fromAddress: string,
  toAddress: string,
  senderPubKey: string,
  amount: number,
  feeRate: number,
  isTestNet: boolean = true
) {
  const network = isTestNet
    ? bitcoin.networks.testnet
    : bitcoin.networks.bitcoin;
  const fromAddressType = getAddressType(fromAddress);
  const toAddressType = getAddressType(toAddress);

  if (toAddressType.script !== "p2tr")
    throw new Error("Please provide an P2TR address.");

  const requiredAmount =
    amount +
    (TX_EMPTY_SIZE + fromAddressType.outputSize + toAddressType.outputSize) *
      feeRate;

  const utxos: unisatUtxo[] = await getUtxos(fromAddress, isTestNet);
  if (!utxos || utxos.length === 0)
    throw new CustomError("Not funded. Utxos not found.", 400);

  const selectedUtxos = prepareInputs(
    utxos,
    requiredAmount,
    fromAddressType.inputSize,
    feeRate
  );
  if (selectedUtxos.inputs.length === 0) {
    throw new CustomError("Insufficient funds to cover required amount", 400);
  }

  const psbt = new bitcoin.Psbt({ network });

  const pubkey = Buffer.from(senderPubKey, "hex");

  await Promise.all(
    selectedUtxos.inputs.map(async (input) => {
      if (fromAddressType.script === "p2pkh") {
        // Legacy (P2PKH)
        const txHex = await getRawTransaction(input.txid);
        psbt.addInput({
          hash: input.txid,
          index: input.vout,
          nonWitnessUtxo: Buffer.from(txHex, "hex"),
        });
      } else if (fromAddressType.script === "p2sh") {
        // Nested SegWit (P2SH-P2WPKH)
        const p2wpkh = bitcoin.payments.p2wpkh({ pubkey, network });
        const p2sh = bitcoin.payments.p2sh({
          redeem: p2wpkh,
          network,
        });
        psbt.addInput({
          hash: input.txid,
          index: input.vout,
          witnessUtxo: {
            script: p2sh.output!,
            value: BigInt(input.satoshi),
          },
          redeemScript: p2wpkh.output,
        });
      } else if (fromAddressType.script === "p2wpkh") {
        // Native SegWit (P2WPKH)
        const p2wpkh = bitcoin.payments.p2wpkh({ pubkey, network });
        psbt.addInput({
          hash: input.txid,
          index: input.vout,
          witnessUtxo: {
            script: p2wpkh.output!,
            value: BigInt(input.satoshi),
          },
        });
      } else if (fromAddressType.script === "p2tr") {
        const p2tr = bitcoin.payments.p2tr({
          internalPubkey: pubkey.slice(1, 33),
          network,
        });
        psbt.addInput({
          hash: input.txid,
          index: input.vout,
          witnessUtxo: {
            script: p2tr.output!,
            value: BigInt(input.satoshi),
          },
          tapInternalKey: pubkey.slice(1, 33),
        });
      } else {
        throw new Error("Unsupported address type");
      }
    })
  );

  if (selectedUtxos.changeAmount >= 546) {
    console.log(`change amount: ${selectedUtxos.changeAmount}`);
    psbt.addOutput({
      address: fromAddress,
      value: BigInt(selectedUtxos.changeAmount),
    });
  }

  psbt.addOutput({ address: toAddress, value: BigInt(amount) });

  return psbt.toHex();
}
