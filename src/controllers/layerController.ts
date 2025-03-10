import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../custom";
import { layerServices } from "../services/layerServices";
import { LAYER, NETWORK } from "../types/db/enums";
import { CustomError } from "../exceptions/CustomError";
import { REDIS_KEYS } from "../libs/constants";
import { FEE_RATE_TYPES } from "../blockchain/bitcoin/constants";
import logger from "../config/winston";

export const layerController = {
  getById: async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    try {
      if (!id) throw new CustomError("Please provide a layer id.", 400);

      // const cachedLayer = await redis.get(`layer:${id}`);
      // if (cachedLayer)
      //   return res
      //     .status(200)
      //     .json({ success: true, data: JSON.parse(cachedLayer) });

      const layer = await layerServices.getById(id);
      if (!layer) throw new CustomError("Layer not found", 404);

      // await redis.set(`layer:${id}`, JSON.stringify(layer), "EX", 300);
      // logger.info("SET GETBYID TO CACHE");

      return res.status(200).json({ success: true, data: layer });
    } catch (e) {
      next(e);
    }
  },

  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      // const cachedLayers = await redis.get("layers");
      // if (cachedLayers)
      //   return res
      //     .status(200)
      //     .json({ success: true, data: JSON.parse(cachedLayers) });

      const layers = await layerServices.getAll();

      // await redis.set("layers", JSON.stringify(layers), "EX", 300);
      // logger.info("SET GETBYID TO CACHE");

      return res.status(200).json({ success: true, data: layers });
    } catch (e) {
      next(e);
    }
  }
  // getFeeRates: async (req: Request, res: Response, next: NextFunction) => {
  //   const { layerId } = req.params;
  //   try {
  //     const layer = await layerServices.getById(layerId);
  //     if (!layer) throw new CustomError("Layer not found.", 400);
  //     if (layer.layer !== "BITCOIN" || layer.network !== "TESTNET")
  //       throw new CustomError("Unsupported layer.", 400);

  //     const feeRatesData = await redis.get(REDIS_KEYS.BITCOIN_FEE_RATES);
  //     if (!feeRatesData)
  //       throw new CustomError("Could not fetch the fee rate data.", 400);

  //     const feeRates: FEE_RATE_TYPES = JSON.parse(feeRatesData);

  //     return res.status(200).json({ success: true, data: feeRates });
  //   } catch (e) {
  //     next(e);
  //   }
  // }
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
