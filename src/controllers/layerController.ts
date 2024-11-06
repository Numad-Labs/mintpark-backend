import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../custom";
import { layerServices } from "../services/layerServices";
import { LAYER, NETWORK } from "../types/db/enums";
import { getEstimatedFee } from "../../blockchain/utxo/calculateRequiredAmount";
import { SERVICE_FEE } from "../../blockchain/utxo/constants";
import { feeRateHelper } from "../../blockchain/utxo/feeRateHelper";
import { CustomError } from "../exceptions/CustomError";

export const layerController = {
  create: async (req: Request, res: Response, next: NextFunction) => {
    const { layer, network, currencyId } = req.body;

    try {
      if (!layer || !network)
        throw new CustomError("Please provide a name, layer and network.", 400);

      const newLayer = await layerServices.create(
        String(layer).toLowerCase(),
        layer.toUpperCase() as LAYER,
        network as NETWORK,
        currencyId
      );

      return res.status(201).json({ success: true, data: newLayer });
    } catch (e) {
      next(e);
    }
  },
  update: async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const data = req.body;

    try {
      if (!id) throw new CustomError("Please provide a layer id.", 400);

      const layer = await layerServices.update(id, data);

      return res.status(200).json({ success: true, data: layer });
    } catch (e) {
      next(e);
    }
  },
  delete: async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    try {
      if (!id) throw new CustomError("Please provide a layer id.", 400);

      const layer = await layerServices.delete(id);

      return res.status(200).json({ success: true, data: layer });
    } catch (e) {
      next(e);
    }
  },
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
  getByName: async (req: Request, res: Response, next: NextFunction) => {
    const { name } = req.params;

    try {
      if (!name) throw new CustomError("Please provide a layer name.", 400);

      const layers = await layerServices.getByName(name);
      return res.status(200).json({ success: true, data: layers });
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
  getFeeRates: async (req: Request, res: Response, next: NextFunction) => {
    const { layerId } = req.params;
    try {
      if (!layerId)
        throw new CustomError("Please provide a layerId as param.", 400);
      const layer = await layerServices.getById(layerId);
      if (!layer) throw new CustomError("Layer not found.", 400);
      let feeRates;
      if (layer.network === "MAINNET")
        feeRates = await feeRateHelper(layer.layer, false);
      else feeRates = await feeRateHelper(layer.layer, true);

      return res.status(200).json({ success: true, data: feeRates });
    } catch (e) {
      next(e);
    }
  },
  getEstimatedFee: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileSizes, fileTypeSizes, feeRate } = req.body;
      if (!fileSizes || !fileTypeSizes || !feeRate)
        throw new CustomError(
          "Please provide a fileSize, fileType and feeRate.",
          400
        );

      const fileSizesArray = fileSizes as number[];
      const fileTypeSizesArray = fileTypeSizes as number[];
      const estimatedFee = getEstimatedFee(
        fileSizesArray,
        fileTypeSizesArray,
        SERVICE_FEE["FRACTAL"]["TESTNET"],
        feeRate
      );

      return res.status(200).json({ success: true, data: estimatedFee });
    } catch (e) {
      next(e);
    }
  },
};
