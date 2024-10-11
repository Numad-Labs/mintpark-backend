import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import * as ecc from "tiny-secp256k1";
import { calculateTransactionSize } from "./txEstimate";
import { calculateInscriptionSize } from "./inscriptionSizeEstimate";
import { LAYER_TYPE } from "../types/db/enums";
import { WITNESS_SCALE_FACTOR } from "./bitcoinL1/libs";

const ECPair = ECPairFactory(ecc);

interface AddressCreationResult {
  address: string;
  privateKey: string;
}

interface FeeCalculationParams {
  layerType: LAYER_TYPE;
  inscriptions: {
    inscriptionContentType: string;
    inscriptionData: Buffer;
  }[];
  price: number;
  feeRate: number;
}

export function createAddressForLayer(
  layerType: LAYER_TYPE,
  network?: any
): AddressCreationResult {
  let selectedNetwork;

  switch (layerType) {
    case LAYER_TYPE.BITCOIN:
      selectedNetwork = network || bitcoin.networks.bitcoin;
      break;
    case LAYER_TYPE.BITCOIN_TESTNET:
      selectedNetwork = network || bitcoin.networks.testnet;
      break;
    case LAYER_TYPE.FRACTAL_TESTNET:
      // Use Bitcoin mainnet network parameters for Fractal testnet
      selectedNetwork = network || bitcoin.networks.bitcoin;
      break;
    case LAYER_TYPE.FRACTAL:
      selectedNetwork = network || bitcoin.networks.testnet;
    default:
      throw new Error(`Not supported for this ${layerType} layer type yet.`);
  }

  return createBitcoinAddress(selectedNetwork, layerType);
}

function createBitcoinAddress(
  network: bitcoin.networks.Network,
  layerType: LAYER_TYPE
): AddressCreationResult {
  const keyPair = ECPair.makeRandom({ network });

  let address;
  if (layerType === LAYER_TYPE.FRACTAL_TESTNET) {
    address = bitcoin.payments.p2tr({
      internalPubkey: keyPair.publicKey.slice(1, 33),
      network: bitcoin.networks.bitcoin,
    }).address;
  } else {
    // For other networks, use P2TR as before
    address = bitcoin.payments.p2tr({
      internalPubkey: keyPair.publicKey.slice(1, 33),
      network,
    }).address;
  }

  if (!address) {
    throw new Error("Could not generate funding address and private key.");
  }

  return {
    address,
    privateKey: keyPair.privateKey!.toString("hex"),
  };
}

// function createEthereumAddress(): AddressCreationResult {
//   const wallet = ethers.Wallet.createRandom();
//   return {
//     address: wallet.address,
//     privateKey: wallet.privateKey,
//   };
// }

export function calculateRequiredAmount(params: FeeCalculationParams): number {
  switch (params.layerType) {
    case LAYER_TYPE.BITCOIN:
    case LAYER_TYPE.BITCOIN_TESTNET:
      return calculateBitcoinRequiredAmount(params);
    case LAYER_TYPE.ETHEREUM:
    case LAYER_TYPE.ETHEREUM_TESTNET:
      return calculateEthereumRequiredAmount(params);
    // Add more cases for other layer types as needed
    case LAYER_TYPE.FRACTAL:
    case LAYER_TYPE.FRACTAL_TESTNET:
      return calculateBitcoinRequiredAmount(params);
    case LAYER_TYPE.COORDINATE:
    case LAYER_TYPE.COORDINATE_TESTNET:
      return calculateBitcoinRequiredAmount(params);
    default:
      throw new Error(
        `Not supported for this ${params.layerType} layer type yet.`
      );
  }
}

function calculateBitcoinRequiredAmount(params: FeeCalculationParams): number {
  let totalInscriptionSize = 0;
  let totalCommitFee = 0;
  let totalRevealFee = 0;

  for (const inscription of params.inscriptions) {
    let body = Buffer.from(inscription.inscriptionData);
    let bodySize = body.length;

    const commitSize = Math.ceil(10 + 58 * 1 + 43 * 3);
    const inscriptionSize = Math.ceil(
      (33 +
        1 +
        1 +
        1 +
        4 +
        2 +
        1 +
        inscription.inscriptionContentType.length +
        2 +
        Math.ceil(bodySize / 520) +
        bodySize) /
        WITNESS_SCALE_FACTOR
    );
    const revealSize = Math.ceil(10 + 58 * 1 + 43 * 1 + inscriptionSize + 10);

    const commitFee = commitSize * params.feeRate;
    const revealFee = revealSize * params.feeRate;

    totalInscriptionSize += inscriptionSize;
    totalCommitFee += commitFee;
    totalRevealFee += revealFee;
  }

  const DUST_THRESHOLD = 546;
  return (
    totalCommitFee +
    totalRevealFee +
    params.price * params.inscriptions.length +
    DUST_THRESHOLD
  );
}

function calculateEthereumRequiredAmount(params: FeeCalculationParams): number {
  const BASE_GAS = 21000;
  const DATA_GAS = params.inscriptions.reduce(
    (total, inscription) => total + inscription.inscriptionData.length * 16,
    0
  );
  const totalGas = BASE_GAS + DATA_GAS;
  return totalGas * params.feeRate + params.price * params.inscriptions.length;
}

// Usage example
export function createFundingAddress(
  params: FeeCalculationParams
): AddressCreationResult & { requiredAmount: number } {
  const { address, privateKey } = createAddressForLayer(params.layerType);
  const requiredAmount = calculateRequiredAmount(params);
  return { address, privateKey, requiredAmount };
}
