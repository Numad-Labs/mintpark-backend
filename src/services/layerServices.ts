import { layerRepository } from "../repositories/layerRepository";
import { LAYER, NETWORK } from "../types/db/enums";

export const layerServices = {
  create: async (name: string, layer: LAYER, network: NETWORK) => {
    const existingLayer = await layerRepository.getByName(name);
    if (existingLayer.length > 1) throw new Error("Layer already exists.");

    const newLayer = await layerRepository.create({
      name,
      layer,
      network,
    });

    return newLayer;
  },
  update: async (id: string, data: any) => {
    const existingLayer = await layerRepository.getById(id);
    if (!existingLayer) throw new Error("No layer found.");

    const layer = await layerRepository.update(id, data);

    return layer;
  },
  delete: async (id: string) => {
    const existingLayer = await layerRepository.getById(id);
    if (!existingLayer) throw new Error("No layer found.");

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
};
