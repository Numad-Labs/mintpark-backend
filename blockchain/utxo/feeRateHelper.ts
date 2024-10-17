import axios from "axios";
import { LAYER } from "../../src/types/db/enums";

export type FeeRates = {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
};

interface FeeRateConfig {
  getFeeRate: (isTestNet: boolean) => Promise<FeeRates>;
}

const feeRateConfigs = new Map<LAYER, FeeRateConfig>([
  [
    LAYER.BITCOIN,
    {
      getFeeRate: async (isTestNet: boolean) => {
        const baseUrl = isTestNet
          ? "https://mempool.space/testnet"
          : "https://mempool.space";
        const response = await axios.get<FeeRates>(
          `${baseUrl}/api/v1/fees/recommended`
        );
        return response.data;
      },
    },
  ],
  [
    LAYER.FRACTAL,
    {
      getFeeRate: async (isTestNet: boolean) => {
        const url = isTestNet
          ? "https://mempool-testnet.fractalbitcoin.io/api/v1/fees/recommended"
          : "https://mempool.fractalbitcoin.io/api/v1/fees/recommended";
        const response = await axios.get<FeeRates>(url);
        return response.data;
      },
    },
  ],
  [
    LAYER.CITREA,
    {
      getFeeRate: async (isTestNet: boolean) => {
        // const url = isTestNet
        //   ? "https://citrea-testnet-api.example.com/fees"
        //   : "https://citrea-mainnet-api.example.com/fees";
        // const response = await axios.get<FeeRates>(url);
        // return response.data;
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

export async function feeRateHelper(
  layerType: LAYER,
  isTestNet: boolean = false
): Promise<FeeRates> {
  try {
    const config = feeRateConfigs.get(layerType);
    if (!config) {
      throw new Error(`Unsupported layer type: ${LAYER[layerType]}`);
    }

    const feeRates = await config.getFeeRate(isTestNet);
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

export async function getAllFeeRates(
  isTestNet: boolean = false
): Promise<Record<LAYER, FeeRates | null>> {
  const allFeeRates: Partial<Record<LAYER, FeeRates | null>> = {};

  for (const layerType of Object.values(LAYER)) {
    try {
      const feeRates = await feeRateHelper(layerType, isTestNet);
      allFeeRates[layerType] = feeRates;
    } catch (error) {
      allFeeRates[layerType] = null;
    }
  }

  return allFeeRates as Record<LAYER, FeeRates | null>;
}
