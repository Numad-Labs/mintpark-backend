import { LAYER_TYPE } from "../types/db/enums";
import axios from "axios";

export type FeeRates = {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
};

interface FeeRateConfig {
  getFeeRate: () => Promise<FeeRates>;
}

const feeRateConfigs = new Map<LAYER_TYPE, FeeRateConfig>([
  [
    LAYER_TYPE.BITCOIN,
    {
      getFeeRate: async () => {
        const response = await axios.get<FeeRates>(
          "https://mempool.space/api/v1/fees/recommended"
        );
        return response.data;
      },
    },
  ],
  [
    LAYER_TYPE.BITCOIN_TESTNET,
    {
      getFeeRate: async () => {
        const response = await axios.get<FeeRates>(
          "https://mempool.space/testnet/api/v1/fees/recommended"
        );
        return response.data;
      },
    },
  ],
  [
    LAYER_TYPE.COORDINATE,
    {
      getFeeRate: async () => {
        return {
          fastestFee: 1,
          halfHourFee: 1,
          hourFee: 1,
          economyFee: 1,
          minimumFee: 1,
        };
      },
    },
  ],
  [
    LAYER_TYPE.COORDINATE_TESTNET,
    {
      getFeeRate: async () => {
        return {
          fastestFee: 1,
          halfHourFee: 1,
          hourFee: 1,
          economyFee: 1,
          minimumFee: 1,
        };
      },
    },
  ],
  [
    LAYER_TYPE.FRACTAL,
    {
      getFeeRate: async () => {
        // Placeholder for Fractal mainnet
        return {
          fastestFee: 1,
          halfHourFee: 1,
          hourFee: 1,
          economyFee: 1,
          minimumFee: 1,
        };
      },
    },
  ],
  [
    LAYER_TYPE.FRACTAL_TESTNET,
    {
      getFeeRate: async () => {
        // Placeholder for Fractal testnet
        return {
          fastestFee: 1,
          halfHourFee: 1,
          hourFee: 1,
          economyFee: 1,
          minimumFee: 1,
        };
      },
    },
  ],
  [
    LAYER_TYPE.ETHEREUM,
    {
      getFeeRate: async () => {
        // Placeholder for Ethereum mainnet
        return {
          fastestFee: 1,
          halfHourFee: 1,
          hourFee: 1,
          economyFee: 1,
          minimumFee: 1,
        };
      },
    },
  ],
  [
    LAYER_TYPE.ETHEREUM_TESTNET,
    {
      getFeeRate: async () => {
        // Placeholder for Ethereum testnet
        return {
          fastestFee: 1,
          halfHourFee: 1,
          hourFee: 1,
          economyFee: 1,
          minimumFee: 1,
        };
      },
    },
  ],
]);

export async function feeRateHelper(layerType: LAYER_TYPE): Promise<FeeRates> {
  try {
    const config = feeRateConfigs.get(layerType);
    if (!config) {
      throw new Error(`Unsupported layer type: ${LAYER_TYPE[layerType]}`);
    }

    const feeRates = await config.getFeeRate();
    return feeRates;
  } catch (error) {
    console.error(
      `Error in feeRateHelper: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw error;
  }
}

export async function getAllFeeRates(): Promise<
  Record<LAYER_TYPE, FeeRates | null>
> {
  const allFeeRates: Partial<Record<LAYER_TYPE, FeeRates | null>> = {};

  for (const layerType of Object.values(LAYER_TYPE)) {
    try {
      const feeRates = await feeRateHelper(layerType);
      allFeeRates[layerType] = feeRates;
    } catch (error) {
      allFeeRates[layerType] = null;
    }
  }

  return allFeeRates as Record<LAYER_TYPE, FeeRates | null>;
}
