import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import * as ecc from "tiny-secp256k1";
import { calculateTransactionSize } from "./txEstimate";
import { calculateInscriptionSize } from "./inscriptionSizeEstimate";

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

  // Calculate inscription size
  const inscriptionSize = calculateInscriptionSize(
    params.inscriptionContentType,
    params.inscriptionData
  );

  // Calculate commit transaction size (1 input, 2 outputs)
  const commitSize = calculateTransactionSize(
    [{ address: address, count: 1 }],
    [
      { address: address, count: 1 }, // Reveal output
      { address: address, count: 1 }, // Change output
    ],
    0,
    network
  );
  const commitFee = commitSize * params.feeRate;

  // Calculate reveal transaction size (1 input, 1 output, with inscription)
  const revealSize = calculateTransactionSize(
    [{ address: address, count: 1 }],
    [{ address: address, count: 1 }], // Assuming the final destination is the same address for simplicity
    inscriptionSize,
    network,
    true
  );
  const revealFee = revealSize * params.feeRate;

  // Calculate total required amount
  const DUST_THRESHOLD = 546; // Minimum amount for an output to be non-dust
  const requiredAmount: number =
    commitFee + revealFee + params.price + DUST_THRESHOLD;

  return {
    address,
    privateKey: keyPair.privateKey!.toString("hex"),
    requiredAmount,
    estimatedFees: {
      commitFee,
      revealFee,
      totalFee: commitFee + revealFee,
    },
    estimatedSizes: {
      commitSize,
      revealSize,
      inscriptionSize,
    },
  };
}
