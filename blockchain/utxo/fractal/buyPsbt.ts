import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory } from "ecpair";
import BIP32Factory from "bip32";
import {
  getAddressType,
  getRawTransaction,
  getUtxos,
  prepareInputs,
} from "./libs";
import { SERVICE_FEE_ADDRESS, TX_EMPTY_SIZE } from "../constants";

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);
const network = bitcoin.networks.bitcoin;

export interface buyPsbtHexInput {
  buyerAddress: string;
  buyerPubKey: string;
  sellerAddress: string;
  vaultAddress: string;
  vaultPrivateKey: string;
  listedPrice: number;
  vaultTxid: string;
  vaultVout: number;
  inscribedAmount: number;
  serviceFee: number;
}

export async function generateBuyPsbtHex(
  data: buyPsbtHexInput,
  feeRate: number,
  isTestnet: boolean
) {
  let serviceFeeReceivingAddress = SERVICE_FEE_ADDRESS.FRACTAL.TESTNET;
  if (!isTestnet)
    serviceFeeReceivingAddress = SERVICE_FEE_ADDRESS.FRACTAL.MAINNET;

  const buyerAddressType = getAddressType(data.buyerAddress);
  const vaultAddressType = getAddressType(data.vaultAddress);
  const sellerAddressType = getAddressType(data.sellerAddress);
  const serviceFeeReceiverAddressType = getAddressType(
    serviceFeeReceivingAddress
  );

  const privateKeyBuffer = Buffer.from(data.vaultPrivateKey, "hex");
  const node = bip32.fromPrivateKey(
    privateKeyBuffer,
    Buffer.alloc(32),
    network
  );
  const publicKey = node.publicKey;
  const psbt = new bitcoin.Psbt({ network: network });

  const requiredAmount =
    data.listedPrice +
    data.inscribedAmount +
    data.serviceFee +
    (TX_EMPTY_SIZE +
      vaultAddressType.inputSize +
      buyerAddressType.outputSize * 2 +
      sellerAddressType.outputSize +
      serviceFeeReceiverAddressType.outputSize) *
      feeRate;

  const utxos = await getUtxos(data.buyerAddress, true);
  const selectedUtxos = await prepareInputs(
    utxos,
    requiredAmount,
    buyerAddressType.inputSize,
    feeRate
  );

  const p2tr = bitcoin.payments.p2tr({
    internalPubkey: publicKey.slice(1, 33),
    network: network,
  });
  //ADD INSCRIPTION INPUT
  psbt.addInput({
    hash: data.vaultTxid,
    index: data.vaultVout,
    witnessUtxo: { script: p2tr.output!, value: BigInt(data.inscribedAmount) },
    tapInternalKey: publicKey.slice(1, 33),
  });

  //ADD FUNDING INPUTS
  for (const input of selectedUtxos.inputs) {
    if (buyerAddressType.script === "p2pkh") {
      // Legacy (P2PKH)
      const txHex = await getRawTransaction(input.txid);
      psbt.addInput({
        hash: input.txid,
        index: input.vout,
        nonWitnessUtxo: Buffer.from(txHex, "hex"),
      });
    } else if (buyerAddressType.script === "p2sh") {
      // Nested SegWit (P2SH-P2WPKH)
      const p2wpkh = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(data.buyerPubKey, "hex"),
        network,
      });
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
    } else if (buyerAddressType.script === "p2wpkh") {
      // Native SegWit (P2WPKH)
      const p2wpkh = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(data.buyerPubKey, "hex"),
        network,
      });
      psbt.addInput({
        hash: input.txid,
        index: input.vout,
        witnessUtxo: {
          script: p2wpkh.output!,
          value: BigInt(input.satoshi),
        },
      });
    } else if (buyerAddressType.script === "p2tr") {
      const p2tr = bitcoin.payments.p2tr({
        internalPubkey: Buffer.from(data.buyerPubKey, "hex").slice(1, 33),
        network,
      });
      psbt.addInput({
        hash: input.txid,
        index: input.vout,
        witnessUtxo: {
          script: p2tr.output!,
          value: BigInt(input.satoshi),
        },
        tapInternalKey: Buffer.from(data.buyerPubKey, "hex").slice(1, 33),
      });
    } else {
      throw new Error("Unsupported address type");
    }
  }

  psbt.addOutput({
    address: data.buyerAddress,
    value: BigInt(data.inscribedAmount),
  });
  psbt.addOutput({
    address: data.sellerAddress,
    value: BigInt(data.listedPrice),
  });
  psbt.addOutput({
    address: serviceFeeReceivingAddress,
    value: BigInt(data.serviceFee),
  });
  if (selectedUtxos.changeAmount >= 546) {
    psbt.addOutput({
      address: data.buyerAddress,
      value: BigInt(selectedUtxos.changeAmount),
    });
  }

  // psbt.signInput(0, tweakedSigner);

  const txHex = psbt.toHex();
  console.log(txHex);

  return txHex;
}

export async function validateSignAndBroadcastBuyPsbtHex(
  hex: string,
  vaultPrivateKey: string,
  sellerAddress: string,
  listedPrice: number
) {
  const psbt = bitcoin.Psbt.fromHex(hex, { network });
  console.log(psbt.txOutputs);
  const isValidPsbt = psbt.txOutputs.filter(
    (output) => output.address === sellerAddress && output.value >= listedPrice
  );
  if (isValidPsbt.length === 0)
    throw new Error("Invalid psbt, no pay output found.");

  const privateKeyBuffer = Buffer.from(vaultPrivateKey, "hex");
  const node = bip32.fromPrivateKey(
    privateKeyBuffer,
    Buffer.alloc(32),
    network
  );
  const tweakedSigner = node.tweak(
    Buffer.from(
      bitcoin.crypto.taggedHash("TapTweak", node.publicKey.slice(1, 33))
    )
  );

  psbt.signInput(0, tweakedSigner);
  psbt.finalizeInput(0);
  const txHex = psbt.extractTransaction(false).toHex();
  console.log(txHex);

  //   const txid = await sendTransaction(txHex);
  //   console.log(txid);

  return txHex;
}
