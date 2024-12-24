import axios, { AxiosError } from "axios";
import logger from "../../config/winston";
import { mempoolFeeRates } from "../../../custom";
import { FEE_RATE_TYPES } from "./constants";

export async function getFeeRates() {
  const response = await axios.get(
    "https://mempool.space/testnet4/api/v1/fees/recommended",
    {
      headers: {
        "Content-Type": "text/plain",
      },
    }
  );

  const feeRateData: mempoolFeeRates = response.data;
  const feeRates: FEE_RATE_TYPES = {
    MINIMUM: feeRateData.minimumFee,
    SLOW: feeRateData.economyFee,
    AVERAGE: feeRateData.hourFee,
    FAST: feeRateData.halfHourFee,
    MAX: feeRateData.fastestFee,
  };

  return feeRates;
}
