import { mintForBitcoin } from "./bitcoinL1/mintCollectible";
import * as bitcoin from "bitcoinjs-lib";
import * as coordinate from "chromajs-lib";
import { mintForAnduroWallet } from "./coordinate/mint";
import { mintingParams } from "../../custom";
import {
  getRecommendedFeeRateBTC,
  getRecommendedFeeRateBTCTestnet,
} from "./bitcoinL1/libs";
import { LAYER_TYPE } from "../types/db/enums";
import { mintForFractal } from "./fractal/mint";
import {
  getRecommendedFeeRateFractal,
  getRecommendedFeeRateFractalTestnet,
} from "./fractal/libs";

interface LayerConfig {
  network: any;
  mintFunction: (params: any, network: any, feeRate: number) => Promise<any>;
  getFeeRate: () => Promise<number>;
}

const layerConfigs = new Map<LAYER_TYPE, LayerConfig>([
  [
    LAYER_TYPE.BITCOIN,
    {
      network: bitcoin.networks.bitcoin,
      mintFunction: mintForBitcoin,
      getFeeRate: getRecommendedFeeRateBTC, // Replace with actual mainnet fee rate function
    },
  ],
  [
    LAYER_TYPE.BITCOIN_TESTNET,
    {
      network: bitcoin.networks.testnet,
      mintFunction: mintForBitcoin,
      getFeeRate: getRecommendedFeeRateBTCTestnet,
    },
  ],
  [
    LAYER_TYPE.COORDINATE,
    {
      network: coordinate.networks.bitcoin,
      mintFunction: mintForAnduroWallet,
      getFeeRate: async () => 1, // Replace with actual Coordinate mainnet fee rate function
    },
  ],
  [
    LAYER_TYPE.COORDINATE_TESTNET,
    {
      network: coordinate.networks.testnet,
      mintFunction: mintForAnduroWallet,
      getFeeRate: async () => 1,
    },
  ],
  [
    LAYER_TYPE.FRACTAL,
    {
      network: bitcoin.networks.testnet,
      mintFunction: mintForFractal,
      getFeeRate: getRecommendedFeeRateFractal,
    },
  ],
  [
    LAYER_TYPE.FRACTAL_TESTNET,
    {
      network: bitcoin.networks.testnet,
      mintFunction: mintForFractal,
      getFeeRate: getRecommendedFeeRateFractalTestnet, // Replace with actual Fractal testnet fee rate function
    },
  ],
]);

export async function mintHelper(params: mintingParams): Promise<any> {
  try {
    const config = layerConfigs.get(params.layerType);
    if (!config) {
      throw new Error(
        `Unsupported layer type: ${LAYER_TYPE[params.layerType]}`
      );
    }

    let feeRate = await config.getFeeRate();
    if (feeRate < params.feeRate) {
      console.warn(
        `Requested fee rate is higher than recommended fee rate. Using recommended fee rate: ${feeRate} sat/vB`
      );
      feeRate = params.feeRate;
    }

    console.log(
      `Minting on ${LAYER_TYPE[params.layerType]}. Fee rate: ${feeRate} sat/vB`
    );

    const result = await config.mintFunction(
      params.mintingParams,
      config.network,
      // feeRate
      1
    );

    return result;
  } catch (error) {
    console.error(
      `Error in mintHelper: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw error;
  }
}
