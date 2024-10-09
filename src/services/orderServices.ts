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
    price: number,
    customFee: number = 1
  ) => {
    try {
      let customAmount = 0;

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
      }

      return {
        estimatedFee: {
          feeRate: customFee,
          networkFee: customAmount - price,
          serviceFee: price,
          totalFee: customAmount,
        },
      };
    } catch (e) {
      throw new Error("Could not get estimated fee ");
    }
  },
};
