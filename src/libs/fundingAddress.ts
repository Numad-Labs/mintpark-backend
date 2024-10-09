import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import * as ecc from "tiny-secp256k1";

const TX_EMPTY_SIZE = 10;
const TX_INPUT_P2TR = 57.5;
const TX_OUTPUT_P2TR = 43;
const WITNESS_SCALE_FACTOR = 4;
const DUST_THRESHOLD = 546;

const ECPair = ECPairFactory(ecc);

export function createP2TRFundingAddress(
  params: {
    inscriptionContentType: string;
    inscriptionData: Buffer;
    price: number;
    feeRate: number;
  },
  network: bitcoin.networks.Network = bitcoin.networks.testnet
) {
  const keyPair = ECPair.makeRandom({ network });
  const { address } = bitcoin.payments.p2tr({
    pubkey: keyPair.publicKey.slice(1, 33),
    network,
  });
  if (!address) {
    throw new Error("Could not derive address from public key.");
  }
  const requiredAmount = calculateRequiredAmount(params);

  return {
    address,
    privateKey: keyPair.privateKey!.toString("hex"),
    requiredAmount,
  };
}

function calculateRequiredAmount(params: {
  inscriptionContentType: string;
  inscriptionData: Buffer;
  price: number;
  feeRate: number;
}): number {
  // Calculate inscription size
  const inscriptionSize = calculateInscriptionSize(
    params.inscriptionContentType,
    params.inscriptionData
  );

  // Calculate commit and reveal transaction sizes
  const commitInputs = 1;
  const commitOutputs = 2; // One for the inscription, one for change
  const commitSize = Math.ceil(
    TX_EMPTY_SIZE +
      TX_INPUT_P2TR * commitInputs +
      TX_OUTPUT_P2TR * commitOutputs
  );

  const revealInputs = 1;
  const revealOutputs = 1;
  const revealSize = Math.ceil(
    TX_EMPTY_SIZE * 2 +
      TX_INPUT_P2TR * revealInputs +
      TX_OUTPUT_P2TR * revealOutputs +
      inscriptionSize / WITNESS_SCALE_FACTOR
  );

  // Calculate total required amount
  const requiredAmount =
    (commitSize + revealSize + params.price + DUST_THRESHOLD) * params.feeRate;

  return requiredAmount;
}

function calculateInscriptionSize(contentType: string, data: Buffer): number {
  const mimeTypeSize = contentType.length;
  const dataSize = data.length;
  const maxChunkSize = 520;

  let size = 2 + mimeTypeSize + 1; // OP_FALSE OP_IF + mime type + OP_0

  for (let i = 0; i < dataSize; i += maxChunkSize) {
    size += Math.min(maxChunkSize, dataSize - i) + 1; // Add 1 for the push opcode
  }

  size += 1; // OP_ENDIF

  return size;
}
