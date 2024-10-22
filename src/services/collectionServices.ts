import {
  collectionRepository,
  LaunchQueryParams,
} from "../repositories/collectionRepository";
import { uploadToS3 } from "../utils/aws";
import { randomUUID } from "crypto";
import { userRepository } from "../repositories/userRepository";
import { CollectionQueryParams } from "../controllers/collectionController";
import { layerRepository } from "../repositories/layerRepository";
import { CustomError } from "../exceptions/CustomError";

export const collectionServices = {
  create: async (data: any, issuerId: string, file?: Express.Multer.File) => {
    const user = await userRepository.getById(issuerId);
    if (!user || !user.layerId) throw new Error("User not found.");

    const layer = await layerRepository.getById(user.layerId);
    if (!layer) throw new Error("User not found.");

    data.layerId = user.layerId;

    /*
      if user.layer is citrea, generate hex to deploy contract

      return that hex with the createdCollection
    */

    if (
      (layer.layer !== "CITREA" && layer.layer !== "FRACTAL") ||
      layer.network !== "TESTNET"
    )
      throw new CustomError("This layer is unsupported for now.", 400);

    let deployContractTxHex = null;
    if (layer.layer === "CITREA" && layer.network === "TESTNET")
      deployContractTxHex = "DULGUUN";

    if (file) {
      const key = randomUUID();
      await uploadToS3(key, file);
      data.logoKey = key;
    }
    const collection = await collectionRepository.create(data);

    return { collection, deployContractTxHex };
  },
  update: async (id: string, data: any) => {
    const collection = await collectionRepository.update(id, data);

    return collection;
  },
  delete: async (id: string) => {
    const collection = await collectionRepository.delete(id);

    return collection;
  },
  getById: async (id: string) => {
    const collection = await collectionRepository.getById(id);

    return collection;
  },
  getAllLaunchedCollectionsByLayerId: async (params: LaunchQueryParams) => {
    const collections =
      await collectionRepository.getAllLaunchedCollectionsByLayerId(params);

    return collections;
  },
  getLaunchedCollectionById: async (id: string) => {
    const collection = await collectionRepository.getLaunchedCollectionById(id);

    return collection;
  },
  getListedCollections: async (params: CollectionQueryParams) => {
    const result = await collectionRepository.getListedCollections(params);

    return result;
  },
};
