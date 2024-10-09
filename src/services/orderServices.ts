import { LAYER_TYPE } from "@prisma/client";
import { feeRateHelper, getAllFeeRates } from "../libs/feeRateHelper";
import { createP2TRFundingAddress } from "../libs/fundingAddress";

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
  getEstimatedFee: async (
    files: Express.Multer.File[],
    layerType: LAYER_TYPE,
    price: number,
    customFee: number = 1
  ) => {
    try {
      const feeRates = await feeRateHelper(layerType);
      let customAmount = 0;
      let fastestAmount = 0;
      let economyAmount = 0;

      for (const file of files) {
        const baseParams = {
          inscriptionContentType: file.mimetype,
          inscriptionData: file.buffer,
          price: price,
        };

        const customFunder = createP2TRFundingAddress({
          ...baseParams,
          feeRate: customFee,
        });
        customAmount += customFunder.requiredAmount;

        const fastestFunder = createP2TRFundingAddress({
          ...baseParams,
          feeRate: feeRates.fastestFee,
        });
        fastestAmount += fastestFunder.requiredAmount;

        const economyFunder = createP2TRFundingAddress({
          ...baseParams,
          feeRate: feeRates.economyFee,
        });
        economyAmount += economyFunder.requiredAmount;
      }

      return {
        fastestFee: fastestAmount,
        economyFee: economyAmount,
        customFee: customAmount,
      };
    } catch (e) {
      throw new Error("Could not get estimated fee ");
    }
  },
};
