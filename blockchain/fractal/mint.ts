import { tokenData, unisatUtxo } from "../../custom";
import { getAddressType, getUtxos, selectUtxos } from "./libs";
import { Taptree } from "bitcoinjs-lib/src/cjs/types";
import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory } from "ecpair";
import BIP32Factory from "bip32";
import { CustomError } from "../../src/exceptions/CustomError";
import { DUST_THRESHOLD } from "../constants";

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);

export async function mint(
  data: tokenData,
  fundingAddress: string,
  fundingPrivateKey: string,
  isTestNet: boolean = true,
  devAddress: string,
  devFee: number,
  feeRate: number,
  toAddress?: string,
  price: number = 0
) {
  const address = fundingAddress;
  const addressType = getAddressType(address);

  const fundingAddressType = getAddressType(fundingAddress);

  let network = bitcoin.networks.bitcoin;
  if (!isTestNet) network = bitcoin.networks.testnet;

  const keyPair = ECPair.fromPrivateKey(Buffer.from(fundingPrivateKey, "hex"), {
    network,
  });

  const privateKey = keyPair.privateKey!;
  if (!privateKey) {
    throw new CustomError("Invalid private key", 400);
  }

  const node = bip32.fromPrivateKey(privateKey, Buffer.alloc(32), network);

  const pubkey = node.publicKey;
  const internalPubKey = toXOnly(pubkey);

  const opreturnData = JSON.stringify(data.opReturnValues);
  const inscriptionData = parseDataUrl(opreturnData);

  let leafScriptAsm = `${internalPubKey.toString(
    "hex"
  )} OP_CHECKSIG OP_FALSE OP_IF `;
  leafScriptAsm += `6f7264 `;
  leafScriptAsm += `01 `;
  const mimeTypeHex = Buffer.from(inscriptionData.contentType).toString("hex");
  leafScriptAsm += `${mimeTypeHex} `;
  leafScriptAsm += `OP_FALSE `;
  const maxChunkSize = 520;
  let body = Buffer.from(inscriptionData.imageBuffer);
  let bodySize = body.length;
  for (let i = 0; i < bodySize; i += maxChunkSize) {
    let end = i + maxChunkSize;
    if (end > bodySize) {
      end = bodySize;
    }
    const chunk = body.slice(i, end);
    const chunkHex = chunk.toString("hex");
    leafScriptAsm += `${chunkHex} `;
  }
  leafScriptAsm += `OP_ENDIF`;

  let leafScript: Uint8Array;
  try {
    leafScript = bitcoin.script.fromASM(leafScriptAsm);
  } catch (error) {
    throw new CustomError("Failed to create leaf script", 400);
  }

  const scriptTree: Taptree = {
    output: leafScript,
  };

  const redeem = {
    output: leafScript,
  };
  const revealP2tr = bitcoin.payments.p2tr({
    internalPubkey: internalPubKey,
    scriptTree,
    redeem,
    network,
  });

  if (!revealP2tr.address) {
    throw new CustomError("Failed to generate reveal address", 500);
  }

  //Calculate Required Amount
  const requiredAmount = 10000;

  //Select Utxos
  const utxos: unisatUtxo[] = await getUtxos(address, isTestNet);
  if (!utxos || utxos.length === 0)
    throw new CustomError("Not funded. Utxos not found.", 400);

  const selectedUtxos = selectUtxos(utxos, requiredAmount);
  if (selectedUtxos.length === 0) {
    throw new CustomError("Insufficient funds to cover required amount", 400);
  }

  const commitPsbt = new bitcoin.Psbt({ network: network });
  let totalAmount = 0;
  for (let i = 0; i < selectedUtxos.length; i++) {
    const utxo = selectedUtxos[i];
    const commitP2tr = bitcoin.payments.p2tr({
      internalPubkey: internalPubKey,
      network: network,
    });
    commitPsbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: commitP2tr.output!,
        value: BigInt(utxo.satoshi),
      },
      tapInternalKey: internalPubKey,
      sequence: 0xfffffffd,
    });
    totalAmount += utxo.satoshi;
  }

  const revealAmount = requiredAmount - price - 1000; // 200 is commitFee for now
  commitPsbt.addOutput({
    address: revealP2tr.address,
    value: BigInt(revealAmount),
  });

  if (toAddress)
    commitPsbt.addOutput({
      address: toAddress,
      value: BigInt(price),
    });

  // Change output
  if (totalAmount - requiredAmount > DUST_THRESHOLD) {
    commitPsbt.addOutput({
      address: data.address,
      value: BigInt(totalAmount - requiredAmount),
    });
  }

  const tweakedSigner = node.tweak(
    Buffer.from(bitcoin.crypto.taggedHash("TapTweak", toXOnly(node.publicKey)))
  );

  for (let i = 0; i < commitPsbt.data.inputs.length; i++) {
    commitPsbt.signInput(i, tweakedSigner);
  }

  const tx = commitPsbt.finalizeAllInputs().extractTransaction(false);
  const commitTxHex = tx.toHex();

  // Reveal transaction
  const LEAF_VERSION_TAPSCRIPT = 192;
  const revealPsbt = new bitcoin.Psbt({ network });

  revealPsbt.addInput({
    hash: tx.getId(),
    index: 0,
    witnessUtxo: {
      value: BigInt(revealAmount),
      script: revealP2tr.output!,
    },
    tapLeafScript: [
      {
        leafVersion: LEAF_VERSION_TAPSCRIPT,
        script: redeem.output,
        controlBlock: revealP2tr.witness![revealP2tr.witness!.length - 1],
      },
    ],
  });

  revealPsbt.addOutput({
    address: data.address,
    value: BigInt(DUST_THRESHOLD),
  });

  revealPsbt.signAllInputs(node);
  const revealTxHex = revealPsbt
    .finalizeAllInputs()
    .extractTransaction(false)
    .toHex();

  return {
    commitTxHex,
    revealTxHex,
  };
}

function toXOnly(pubkey: Buffer): Buffer {
  return pubkey.slice(1, 33);
}

export function parseDataUrl(dataUrl: string | any) {
  const [metadata, base64Data] = dataUrl.split(",");

  // Extract the content type
  const contentType = metadata.split(":")[1].split(";")[0];

  // Decode the base64 data to a buffer
  const imageBuffer = Buffer.from(base64Data, "base64");

  return { imageBuffer, contentType };
}
