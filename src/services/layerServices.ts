import { CustomError } from "../exceptions/CustomError";
import { layerRepository } from "../repositories/layerRepository";
import { LAYER, NETWORK } from "../types/db/enums";

export const layerServices = {
  create: async (
    name: string,
    layer: LAYER,
    network: NETWORK,
    currencyId: string
  ) => {
    const existingLayer = await layerRepository.getByName(name);
    if (existingLayer.length > 1)
      throw new CustomError("Layer already exists.", 400);

    const newLayer = await layerRepository.create({
      name,
      layer,
      network,
      currencyId
    });

    return newLayer;
  },
  update: async (id: string, data: any) => {
    const existingLayer = await layerRepository.getById(id);
    if (!existingLayer) throw new CustomError("No layer found.", 400);

    const layer = await layerRepository.update(id, data);

    return layer;
  },
  delete: async (id: string) => {
    const existingLayer = await layerRepository.getById(id);
    if (!existingLayer) throw new CustomError("No layer found.", 400);

    const layer = await layerRepository.delete(id);

    return layer;
  },
  getById: async (id: string) => {
    const layer = await layerRepository.getById(id);

    return layer;
  },
  getByName: async (name: string) => {
    const layers = await layerRepository.getByName(name);

    return layers;
  },
  getAll: async () => {
    const layers = await layerRepository.getAll();

    return layers;
  },
  checkIfSupportedLayerOrThrow: async (layerId: string) => {
    const layer = await layerRepository.getById(layerId);
    if (!layer) throw new CustomError("Layer not found.", 400);

    if (layer.layerType === "EVM" && layer.network === "TESTNET") return layer;

    throw new CustomError("Unsupported layer.", 400);
  }
};
