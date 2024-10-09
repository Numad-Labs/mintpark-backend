import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import * as ecc from "tiny-secp256k1";
import { calculateTransactionSize } from "./txEstimate";
import { calculateInscriptionSize } from "./inscriptionSizeEstimate";

const ECPair = ECPairFactory(ecc);

//TODO: fix requiredAmount calculation wrong amount !!!!!
export function createP2TRFundingAddress(
  params: {
    inscriptionContentType: string;
    inscriptionData: Buffer;
  }[],
  price: number,
  feeRate: number,
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
  let totalInscriptionSize = 0;
  let totalCommitFee = 0;
  let totalRevealFee = 0;
  for (const param of params) {
    let inscriptionSize = calculateInscriptionSize(
      param.inscriptionContentType,
      param.inscriptionData
    );
    const commitSize = calculateTransactionSize(
      [{ address: address, count: 1 }],
      [
        { address: address, count: 1 }, // Reveal output
        { address: address, count: 1 }, // Change output
      ],
      0
    );
    let commitFee = commitSize * feeRate;

    const revealSize = calculateTransactionSize(
      [{ address: address, count: 1 }],
      [{ address: address, count: 1 }], // Assuming the final destination is the same address for simplicity
      inscriptionSize,
      true
    );
    let revealFee = revealSize * feeRate;

    totalInscriptionSize += inscriptionSize;
    totalCommitFee += commitFee;
    totalRevealFee += revealFee;
  }

  // Calculate total required amount
  const DUST_THRESHOLD = 546; // Minimum amount for an output to be non-dust
  const requiredAmount: number =
    totalCommitFee + totalRevealFee + price * params.length + DUST_THRESHOLD;

  return {
    address,
    privateKey: keyPair.privateKey!.toString("hex"),
    requiredAmount,
  };
}
