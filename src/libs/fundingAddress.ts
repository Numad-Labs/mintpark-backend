import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import * as ecc from "tiny-secp256k1";
import { calculateTransactionSize } from "./txEstimate";
import { calculateInscriptionSize } from "./inscriptionSizeEstimate";
import { LAYER_TYPE } from "../types/db/enums";

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
  switch (layerType) {
    case LAYER_TYPE.BITCOIN:
    case LAYER_TYPE.BITCOIN_TESTNET:
      return createBitcoinAddress(
        network ||
          (layerType === LAYER_TYPE.BITCOIN
            ? bitcoin.networks.bitcoin
            : bitcoin.networks.testnet)
      );
    // Add more cases for other layer types as needed
    default:
      throw new Error(`Unsupported layer type: ${layerType}`);
  }
}

function createBitcoinAddress(
  network: bitcoin.networks.Network
): AddressCreationResult {
  const keyPair = ECPair.makeRandom({ network });
  const { address } = bitcoin.payments.p2tr({
    pubkey: keyPair.publicKey.slice(1, 33),
    network,
  });
  if (!address) {
    throw new Error("Could not derive Bitcoin address from public key.");
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
    default:
      throw new Error(`Unsupported layer type: ${params.layerType}`);
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
    const inscriptionSize = Math.ceil(bodySize / 4);
    const revealSize = Math.ceil(10 + 58 * 1 + 43 * 1 + inscriptionSize);

    const commitFee = commitSize * params.feeRate;
    const revealFee = revealSize * params.feeRate;

    totalInscriptionSize += inscriptionSize;
    totalCommitFee += commitFee;
    totalRevealFee += revealFee;
    // const inscriptionSize = calculateInscriptionSize(
    //   inscription.inscriptionContentType,
    //   inscription.inscriptionData
    // );

    // const commitSize = calculateTransactionSize(
    //   [{ address: "tb1p", count: 1 }],
    //   [
    //     { address: "tb1p", count: 1 }, // Reveal output
    //     { address: "tb1p", count: 1 }, // Change output
    //   ],
    //   0
    // );
    // const commitFee = commitSize * params.feeRate;

    // const revealSize = calculateTransactionSize(
    //   [{ address: "tb1p", count: 1 }],
    //   [{ address: "tb1p", count: 1 }],
    //   inscriptionSize,
    //   true
    // );
    // const revealFee = revealSize * params.feeRate;

    // totalInscriptionSize += inscriptionSize;
    // totalCommitFee += commitFee;
    // totalRevealFee += revealFee;
  }

  const DUST_THRESHOLD = 546;
  console.log({
    totalInscriptionSize,
    totalCommitFee,
    totalRevealFee,
    price: params.price,
    requiredAmount:
      totalCommitFee +
      totalRevealFee +
      params.price * params.inscriptions.length +
      DUST_THRESHOLD,
      
  });
  return (
    totalCommitFee +
    totalRevealFee +
    params.price * params.inscriptions.length +
    DUST_THRESHOLD
  );
}

function calculateEthereumRequiredAmount(params: FeeCalculationParams): number {
  // Implement Ethereum-specific fee calculation
  // This is a placeholder and should be replaced with actual Ethereum fee estimation logic
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
