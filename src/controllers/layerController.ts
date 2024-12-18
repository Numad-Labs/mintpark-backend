import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../custom";
import { layerServices } from "../services/layerServices";
import { LAYER, NETWORK } from "../types/db/enums";
import { CustomError } from "../exceptions/CustomError";

export const layerController = {
  getById: async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    try {
      if (!id) throw new CustomError("Please provide a layer id.", 400);

      const layer = await layerServices.getById(id);
      return res.status(200).json({ success: true, data: layer });
    } catch (e) {
      next(e);
    }
  },
  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const layers = await layerServices.getAll();
      return res.status(200).json({ success: true, data: layers });
    } catch (e) {
      next(e);
    }
  },
  // getFeeRates: async (req: Request, res: Response, next: NextFunction) => {
  //   const { layerId } = req.params;
  //   try {
  //     if (!layerId)
  //       throw new CustomError("Please provide a layerId as param.", 400);
  //     const layer = await layerServices.getById(layerId);
  //     if (!layer) throw new CustomError("Layer not found.", 400);
  //     let feeRates;
  //     if (layer.network === "MAINNET")
  //       feeRates = await feeRateHelper(layer.layer, false);
  //     else feeRates = await feeRateHelper(layer.layer, true);

  //     return res.status(200).json({ success: true, data: feeRates });
  //   } catch (e) {
  //     next(e);
  //   }
  // },
  // getEstimatedFee: async (req: Request, res: Response, next: NextFunction) => {
  //   try {
  //     const { fileSizes, fileTypeSizes, feeRate } = req.body;
  //     if (!fileSizes || !fileTypeSizes || !feeRate)
  //       throw new CustomError(
  //         "Please provide a fileSize, fileType and feeRate.",
  //         400
  //       );

  //     const fileSizesArray = fileSizes as number[];
  //     const fileTypeSizesArray = fileTypeSizes as number[];
  //     const estimatedFee = getEstimatedFee(
  //       fileSizesArray,
  //       fileTypeSizesArray,
  //       SERVICE_FEE["FRACTAL"]["TESTNET"],
  //       feeRate
  //     );

  //     return res.status(200).json({ success: true, data: estimatedFee });
  //   } catch (e) {
  //     next(e);
  //   }
  // },
};
