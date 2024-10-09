import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory } from "ecpair";
import BIP32Factory from "bip32";
import {
  getUtxosWithAddress,
  selectUtxos,
  TX_EMPTY_SIZE,
  TX_INPUT_P2TR,
  TX_OUTPUT_P2TR,
  WITNESS_SCALE_FACTOR,
} from "./libs";
import { calculateTransactionSize } from "../txEstimate";
import { calculateInscriptionSize } from "../inscriptionSizeEstimate";

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);

function toXOnly(pubkey: Buffer): Buffer {
  return pubkey.slice(1, 33);
}

interface BRC20DeployParams {
  tick: string;
  max: string;
  lim?: string;
  address: string;
  fundingAddress: string;
  fundingPrivateKey: string;
}

export async function deployBRC20(
  params: BRC20DeployParams,
  feeRate: number,
  network: bitcoin.networks.Network = bitcoin.networks.testnet
) {
  const keyPair = ECPair.fromPrivateKey(
    Buffer.from(params.fundingPrivateKey, "hex"),
    { network }
  );
  const address = params.fundingAddress;

  const privateKey = keyPair.privateKey!;
  const node = bip32.fromPrivateKey(privateKey, Buffer.alloc(32), network);
  const pubkey = node.publicKey;
  const internalPubKey = toXOnly(pubkey); // Remove the first byte

  // Create the BRC-20 deploy inscription
  const inscriptionData = JSON.stringify({
    p: "brc-20",
    op: "deploy",
    tick: params.tick,
    ...(params.lim && { lim: params.lim }),
    max: params.max,
  });

  const inscriptionSize = calculateInscriptionSize(
    "application/json",
    Buffer.from(inscriptionData, "utf8")
  );

  const leafScript = bitcoin.script.compile([
    internalPubKey,
    bitcoin.opcodes.OP_CHECKSIG,
    bitcoin.opcodes.OP_0,
    bitcoin.opcodes.OP_IF,
    Buffer.from("6f7264", "hex"), // 'ord'
    Buffer.from([0x01]), // protocol version
    Buffer.from("text/plain;charset=utf-8", "utf8"),
    bitcoin.opcodes.OP_0,
    Buffer.from(inscriptionData, "utf8"),
    bitcoin.opcodes.OP_ENDIF,
  ]);

  const scriptTree = {
    output: leafScript,
  };
  const revealP2tr = bitcoin.payments.p2tr({
    internalPubkey: internalPubKey,
    scriptTree,
    redeem: { output: leafScript },
    network,
  });

  // Calculate fees
  const dustThreshold = 546;
  const commitInputs = [{ address: params.fundingAddress, count: 1 }];
  const commitOutputs = [
    { address: revealP2tr.address!, count: 1 },
    { address: params.fundingAddress, count: 1 }, // Change output
  ];
  const commitSize = calculateTransactionSize(
    commitInputs,
    commitOutputs,
    0,
    false
  );
  const commitFee = commitSize * feeRate;

  const revealInputs = [{ address: revealP2tr.address!, count: 1 }];
  const revealOutputs = [{ address: params.address, count: 1 }];
  const revealSize =
    calculateTransactionSize(
      revealInputs,
      revealOutputs,
      inscriptionSize,
      true
    ) + inscriptionSize;
  const revealFee = revealSize * feeRate;

  const requiredAmount = commitFee + revealFee + dustThreshold;

  // In a real scenario, you'd fetch UTXOs here
  const utxos = await getUtxosWithAddress(address, network);
  if (!utxos || utxos.length === 0)
    throw new Error("Not funded. UTXOs not found.");

  const selectedUtxos = selectUtxos(utxos, requiredAmount);

  // Commit transaction
  const commitPsbt = new bitcoin.Psbt({ network });
  let totalAmount = 0;
  for (const utxo of selectedUtxos) {
    const commitP2tr = bitcoin.payments.p2tr({
      internalPubkey: internalPubKey,
      network,
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

  const revealAmount = requiredAmount - commitFee;
  commitPsbt.addOutput({
    address: revealP2tr.address!,
    value: revealAmount,
  });

  // Change output
  if (totalAmount - requiredAmount > dustThreshold) {
    commitPsbt.addOutput({
      address: address,
      value: totalAmount - requiredAmount,
    });
  }

  const tweakedSigner = node.tweak(
    bitcoin.crypto.taggedHash("TapTweak", internalPubKey)
  );

  for (let i = 0; i < commitPsbt.data.inputs.length; i++) {
    commitPsbt.signInput(i, tweakedSigner);
  }

  const commitTx = commitPsbt.finalizeAllInputs().extractTransaction();
  const commitTxHex = commitTx.toHex();
  const commitTxId = commitTx.getId();

  // Reveal transaction
  const LEAF_VERSION_TAPSCRIPT = 0xc0; // 192 in decimal
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
        script: leafScript,
        controlBlock: revealP2tr.witness![revealP2tr.witness!.length - 1],
      },
    ],
  });

  revealPsbt.addOutput({
    value: dustThreshold,
    address: params.address, // For deploy, we send back to the deployer's address
  });

  revealPsbt.signInput(0, node);
  const revealTx = revealPsbt.finalizeAllInputs().extractTransaction();
  const revealTxHex = revealTx.toHex();
  const revealTxId = revealTx.getId();

  console.log({
    calculated_fee: {
      commitSize,
      commitFee,
      revealSize,
      revealFee,
      requiredAmount,
    },
  });
  console.log({
    actual_fee: {
      commitTxSize: commitTx.virtualSize(),
      commitTxFee: commitTx.virtualSize() * feeRate,
      revealTxSize: revealPsbt.extractTransaction().virtualSize(),
      revealTxFee: revealPsbt.extractTransaction().virtualSize() * feeRate,
      requiredAmount:
        commitTx.virtualSize() * feeRate +
        revealPsbt.extractTransaction().virtualSize() * feeRate +
        dustThreshold,
    },
  });

  return {
    commitTxId,
    commitTxHex,
    revealTxId,
    revealTxHex,
  };
}

interface BRC20MintParams {
  tick: string;
  amt: string;
  toAddress: string;
  fundingAddress: string;
  fundingPrivateKey: string;
}

export async function mintBRC20(
  params: BRC20MintParams,
  network: bitcoin.networks.Network = bitcoin.networks.testnet,
  feeRate: number
) {
  const keyPair = ECPair.fromPrivateKey(
    Buffer.from(params.fundingPrivateKey, "hex"),
    { network }
  );
  const address = params.fundingAddress;

  const privateKey = keyPair.privateKey!;
  const node = bip32.fromPrivateKey(privateKey, Buffer.alloc(32), network);

  const pubkey = node.publicKey;
  const internalPubKey = pubkey.slice(1, 33); // Remove the first byte

  // Create the BRC-20 mint inscription
  const inscriptionData = JSON.stringify({
    p: "brc-20",
    op: "mint",
    tick: params.tick,
    amt: params.amt,
  });

  let leafScriptAsm = `${internalPubKey.toString(
    "hex"
  )} OP_CHECKSIG OP_FALSE OP_IF `;
  leafScriptAsm += `6f7264 `; // ord
  leafScriptAsm += `01 `;
  leafScriptAsm += `${Buffer.from("application/json").toString("hex")} `;
  leafScriptAsm += `OP_0 `;
  leafScriptAsm += `${Buffer.from(inscriptionData).toString("hex")} `;
  leafScriptAsm += `OP_ENDIF`;

  const leafScript = bitcoin.script.fromASM(leafScriptAsm);

  const scriptTree = {
    output: leafScript,
  };

  const revealP2tr = bitcoin.payments.p2tr({
    internalPubkey: internalPubKey,
    scriptTree,
    redeem: { output: leafScript },
    network,
  });

  // Calculate fees
  const dustThreshold = 546;
  const commitInputs = 1;
  const commitOutputs = 2;
  const commitSize = Math.ceil(
    TX_EMPTY_SIZE +
      TX_INPUT_P2TR * commitInputs +
      TX_OUTPUT_P2TR * commitOutputs
  );

  const revealInputs = 1;
  const revealOutputs = 1;
  const inscriptionSize = Math.ceil(leafScript.length / WITNESS_SCALE_FACTOR);
  const revealSize = Math.ceil(
    TX_EMPTY_SIZE * 2 +
      TX_INPUT_P2TR * revealInputs +
      TX_OUTPUT_P2TR * revealOutputs +
      inscriptionSize
  );

  const requiredAmount = (commitSize + revealSize + dustThreshold) * feeRate;

  // In a real scenario, you'd fetch UTXOs here
  const utxos = await getUtxosWithAddress(address, network);
  if (!utxos || utxos.length === 0)
    throw new Error("Not funded. UTXOs not found.");

  const selectedUtxos = selectUtxos(utxos, requiredAmount);

  // Commit transaction
  const commitPsbt = new bitcoin.Psbt({ network });
  let totalAmount = 0;
  for (const utxo of selectedUtxos) {
    const commitP2tr = bitcoin.payments.p2tr({
      internalPubkey: internalPubKey,
      network,
    });
    commitPsbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: commitP2tr.output!,
        value: utxo.satoshi,
      },
      tapInternalKey: internalPubKey,
    });
    totalAmount += utxo.satoshi;
  }

  const revealAmount = requiredAmount - commitSize;
  commitPsbt.addOutput({
    address: revealP2tr.address!,
    value: revealAmount,
  });

  // Change output
  if (totalAmount - requiredAmount > dustThreshold) {
    commitPsbt.addOutput({
      address: address,
      value: totalAmount - requiredAmount,
    });
  }

  const tweakedSigner = node.tweak(
    bitcoin.crypto.taggedHash("TapTweak", internalPubKey)
  );

  for (let i = 0; i < commitPsbt.data.inputs.length; i++) {
    commitPsbt.signInput(i, tweakedSigner);
  }

  const commitTx = commitPsbt.finalizeAllInputs().extractTransaction();
  const commitTxHex = commitTx.toHex();
  const commitTxId = commitTx.getId();

  // Reveal transaction
  const LEAF_VERSION_TAPSCRIPT = 0xc0; // 192 in decimal
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
        script: leafScript,
        controlBlock: revealP2tr.witness![revealP2tr.witness!.length - 1],
      },
    ],
  });

  revealPsbt.addOutput({
    value: dustThreshold,
    address: params.toAddress,
  });

  revealPsbt.signInput(0, node);
  const revealTx = revealPsbt.finalizeAllInputs().extractTransaction();
  const revealTxHex = revealTx.toHex();
  const revealTxId = revealTx.getId();

  return {
    commitTxId,
    commitTxHex,
    revealTxId,
    revealTxHex,
  };
}
