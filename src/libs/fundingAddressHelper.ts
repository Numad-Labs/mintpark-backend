import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import * as ecc from "tiny-secp256k1";
import { LAYER } from "../types/db/enums";

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

export function createFundingAddress(layerType: LAYER, network: string) {
  let selectedNetwork;

  switch (layerType) {
    case LAYER.BITCOIN:
      if (network === "MAINNET") {
        selectedNetwork = bitcoin.networks.bitcoin;
      } else {
        selectedNetwork = bitcoin.networks.testnet;
      }
      break;
    case LAYER.FRACTAL:
      // Use Bitcoin mainnet network parameters for Fractal testnet
      if (network === "TESTNET") {
        selectedNetwork = bitcoin.networks.bitcoin;
      } else {
        selectedNetwork = bitcoin.networks.testnet;
      }
      break;
    default:
      throw new Error(
        `Not supported for this ${layerType}: ${network} layer type yet.`
      );
  }

  return createP2TRBitcoinAddress(selectedNetwork);
}

function createP2TRBitcoinAddress(network: bitcoin.networks.Network) {
  const keyPair = ECPair.makeRandom({ network });
  let address;
  try {
    address = bitcoin.payments.p2tr({
      internalPubkey: keyPair.publicKey.slice(1, 33),
      network: network,
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
