import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory } from "ecpair";
import { Taptree } from "bitcoinjs-lib/src/types";
import BIP32Factory from "bip32";
import { CustomError } from "../../exceptions/CustomError";
import { inscriptionData, tokenData, unisatUtxo } from "../../../custom";
import {
  getUtxosWithAddress,
  selectUtxos,
  TX_EMPTY_SIZE,
  TX_INPUT_P2TR,
  TX_OUTPUT_P2TR,
  WITNESS_SCALE_FACTOR,
} from "./libs";
import { calculateUnsignedSegwitTxid } from "./libs";
import { parseDataUrl } from "../parseImage";
import axios from "axios";
import { rpcPassword, rpcUser } from "../constants";

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);

function toXOnly(pubkey: Buffer): Buffer {
  return pubkey.slice(1, 33);
}

export async function mintForBitcoin(
  params: {
    data: tokenData;
    toAddress: string;
    price: number;
    fundingAddress: string;
    fundingPrivateKey: string;
  },
  network: bitcoin.networks.Network = bitcoin.networks.testnet,
  feeRate: number
) {
  try {
    const keyPair = ECPair.fromPrivateKey(
      Buffer.from(params.fundingPrivateKey, "hex"),
      { network }
    );
    const address = params.fundingAddress;

    const privateKey = keyPair.privateKey!;
    if (!privateKey) {
      throw new CustomError("Invalid private key", 400);
    }

    const node = bip32.fromPrivateKey(privateKey, Buffer.alloc(32), network);

    const pubkey = node.publicKey;
    const internalPubKey = toXOnly(pubkey);

    console.log({
      nodePubKey: pubkey.toString("hex"),
      internalPubKey: internalPubKey.toString("hex"),
    });

    // Create the base script ASM
    const payloadData = JSON.stringify(params.data.opReturnValues);
    let inscriptionData: inscriptionData;
    try {
      inscriptionData = parseDataUrl(
        payloadData,
        params.data.supply,
        params.data.address
      );
    } catch (error) {
      throw new CustomError("Failed to parse data URL", 400);
    }

    let leafScriptAsm = `${internalPubKey.toString(
      "hex"
    )} OP_CHECKSIG OP_FALSE OP_IF `;
    leafScriptAsm += `6f7264 `;
    leafScriptAsm += `01 `;
    const mimeTypeHex = Buffer.from(inscriptionData.contentType).toString(
      "hex"
    );
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

    let leafScript: Buffer;
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

    const dustThreshold = 546;
    const commitInputs = 1;
    const commitOutputs = 3;
    const commitSize = Math.ceil(
      TX_EMPTY_SIZE +
        TX_INPUT_P2TR * commitInputs +
        TX_OUTPUT_P2TR * commitOutputs
    );
    const commitFee = commitSize * feeRate;
    const revealInputs = 1;
    const revealOutputs = 1;
    const inscriptionSize = Math.ceil(leafScript.length / WITNESS_SCALE_FACTOR);
    const revealSize = Math.ceil(
      TX_EMPTY_SIZE +
        10 +
        TX_INPUT_P2TR * revealInputs +
        TX_OUTPUT_P2TR * revealOutputs +
        inscriptionSize
    );
    const revealFee = revealSize * feeRate;
    const requiredAmount = commitFee + revealFee + params.price + dustThreshold;

    const utxos: unisatUtxo[] = await getUtxosWithAddress(address, network);
    if (!utxos || utxos.length === 0)
      throw new CustomError("Not funded. Utxos not found.", 400);

    const selectedUtxos = selectUtxos(utxos, requiredAmount);
    if (selectedUtxos.length === 0) {
      throw new CustomError("Insufficient funds to cover required amount", 400);
    }

    // Commit transaction
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
          value: utxo.satoshi,
        },
        tapInternalKey: internalPubKey,
        sequence: 0xfffffffd,
      });
      totalAmount += utxo.satoshi;
    }

    const revealAmount = requiredAmount - commitFee - params.price;

    commitPsbt.addOutput({
      address: revealP2tr.address,
      value: revealAmount,
    });
    commitPsbt.addOutput({
      address: params.toAddress,
      value: params.price,
    });

    // Change output
    if (totalAmount - requiredAmount > dustThreshold) {
      commitPsbt.addOutput({
        address: params.data.address,
        value: totalAmount - requiredAmount,
      });
    }

    const tweakedSigner = node.tweak(
      bitcoin.crypto.taggedHash("TapTweak", toXOnly(node.publicKey))
    );

    for (let i = 0; i < commitPsbt.data.inputs.length; i++) {
      commitPsbt.signInput(i, tweakedSigner);
    }

    const tx = commitPsbt.finalizeAllInputs().extractTransaction(false);
    const commitTxHex = tx.toHex();
    const commitTxId = calculateUnsignedSegwitTxid(commitPsbt);

    // Reveal transaction
    const LEAF_VERSION_TAPSCRIPT = 192;
    const revealPsbt = new bitcoin.Psbt({ network });

    revealPsbt.addInput({
      hash: commitTxId,
      index: 0,
      witnessUtxo: {
        value: revealAmount,
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
      address: params.data.address,
      value: dustThreshold,
    });

    revealPsbt.signAllInputs(node);
    const revealTxHex = revealPsbt
      .finalizeAllInputs()
      .extractTransaction(false)
      .toHex();
    const revealTxId = calculateUnsignedSegwitTxid(revealPsbt);

    console.log({
      calculated_fee: {
        commitSize,
        commitFee,
        revealSize,
        revealFee,
        requiredAmount,
        price: params.price,
      },
    });

    console.log({
      actual_fee: {
        commitTxSize: tx.virtualSize(),
        commitTxFee: tx.virtualSize() * feeRate,
        revealTxSize: revealPsbt.extractTransaction().virtualSize(),
        revealTxFee: revealPsbt.extractTransaction().virtualSize() * feeRate,
        requiredAmount:
          tx.virtualSize() * feeRate +
          revealPsbt.extractTransaction().virtualSize() * feeRate +
          params.price +
          dustThreshold,
        price: params.price,
      },
    });

    return {
      commitTxId,
      commitTxHex,
      revealTxId,
      revealTxHex,
    };
  } catch (error) {
    console.error("Error in mintForBitcoin:", error);
    if (error instanceof CustomError) {
      throw error;
    } else {
      throw new CustomError("An unexpected error occurred during minting", 500);
    }
  }
}

export async function sendTransaction(
  txHex: string,
  network: bitcoin.networks.Network = bitcoin.networks.testnet
) {
  try {
    const auth = Buffer.from(`${rpcUser}:${rpcPassword}`).toString("base64");
    const baseUrl =
      network === bitcoin.networks.testnet
        ? "http://localhost:18332"
        : "http://localhost:8332";
    const body = {
      jsonrpc: "1.0",
      method: "sendrawtransaction",
      id: "curltest",
      params: [txHex],
    };
    const result = axios.post(baseUrl, body, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
    });
    return result;
  } catch (error) {
    console.error("Error in sendTransaction:", error);
    throw new CustomError("An unexpected error occurred during sending", 500);
  }
}
