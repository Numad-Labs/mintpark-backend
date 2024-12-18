import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import * as ecc from "tiny-secp256k1";
import { NETWORK } from "../../types/db/enums";

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

export function createFundingAddress(network: NETWORK) {
  const bitcoinNetwork =
    network === "TESTNET" ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
  const keyPair = ECPair.makeRandom({ network: bitcoinNetwork });

  let address;
  try {
    address = bitcoin.payments.p2tr({
      internalPubkey: keyPair.publicKey.slice(1, 33),
      network: bitcoinNetwork,
    }).address!;
  } catch (error) {
    console.log(error);
    throw new Error("Could not generate funding address and private key.");
  }

  return {
    address,
    publicKey: keyPair.publicKey.toString("hex"),
    privateKey: keyPair.privateKey!.toString("hex"),
  };
}
