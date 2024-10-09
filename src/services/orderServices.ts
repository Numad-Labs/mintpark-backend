import { LAYER_TYPE } from "@prisma/client";
import { feeRateHelper, getAllFeeRates } from "../libs/feeRateHelper";

export const orderServices = {
  getFeeRates: async (layerType: LAYER_TYPE) => {
    // Replace with actual fee rate function
    try {
      const fees = await feeRateHelper(layerType);
      return fees;
    } catch (error) {
      throw new Error("Could not get fee rates");
    }
  },
  getAllFeeRates: async () => {
    try {
      const fees = await getAllFeeRates();
      return fees;
    } catch (error) {
      throw new Error("Could not get fee rates");
    }
  },
};
