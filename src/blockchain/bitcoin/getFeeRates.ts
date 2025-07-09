import axios, { AxiosError } from "axios";
import logger from "../../config/winston";
import { mempoolFeeRates } from "../../../custom";

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

  return feeRateData;
}
