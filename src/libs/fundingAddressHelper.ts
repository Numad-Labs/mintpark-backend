import { LAYER_TYPE } from "../../blockchain/constants";
import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import * as ecc from "tiny-secp256k1";

const ECPair = ECPairFactory(ecc);

export function createFundingAddress(layerType: LAYER_TYPE) {
  let selectedNetwork;

  switch (layerType) {
    case LAYER_TYPE.BITCOIN:
      selectedNetwork = bitcoin.networks.bitcoin;
      break;
    case LAYER_TYPE.BITCOIN_TESTNET:
      selectedNetwork = bitcoin.networks.testnet;
      break;
    case LAYER_TYPE.FRACTAL_TESTNET:
      // Use Bitcoin mainnet network parameters for Fractal testnet
      selectedNetwork = bitcoin.networks.bitcoin;
      break;
    case LAYER_TYPE.FRACTAL:
      selectedNetwork = bitcoin.networks.testnet;
    default:
      throw new Error(`Not supported for this ${layerType} layer type yet.`);
  }

  return createP2TRBitcoinAddress(selectedNetwork);
}

function createP2TRBitcoinAddress(network: bitcoin.networks.Network) {
  const keyPair = ECPair.makeRandom({ network });

  let address;
  try {
    address = bitcoin.payments.p2tr({
      internalPubkey: keyPair.publicKey,
      network,
    }).address!;
  } catch (error) {
    throw new Error("Could not generate funding address and private key.");
  }

  if (!address) {
    throw new Error("Could not generate funding address and private key.");
  }

  return {
    address,
    publicKey: keyPair.publicKey.toString("hex"),
    privateKey: keyPair.privateKey!.toString("hex"),
  };
}
