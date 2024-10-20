import { collectionRepository } from "../repositories/collectionRepository";
import { uploadToS3 } from "../utils/aws";
import { randomUUID } from "crypto";
import { Collection } from "../types/db/types";
import { userRepository } from "../repositories/userRepository";
import { CollectionQueryParams } from "../controllers/collectionController";

export const collectionServices = {
  create: async (data: any, issuerId: string, file?: Express.Multer.File) => {
    const user = await userRepository.getById(issuerId);
    if (!user) throw new Error("User not found.");

    data.layerId = user.layerId;

    if (file) {
      const key = randomUUID();
      await uploadToS3(key, file);
      data.logoKey = key;
    }
    const collection = await collectionRepository.create(data);

    return collection;
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
  getAllLaunchedCollections: async () => {
    const collections = await collectionRepository.getAllLaunchedCollections();

    return collections;
  },
  getAllLaunchedCollectionsByLayerId: async (layerId: string) => {
    const collections =
      await collectionRepository.getAllLaunchedCollectionsByLayerId(layerId);

    return collections;
  },
  getListedCollections: async (params: CollectionQueryParams) => {
    const result = await collectionRepository.getListedCollections(params);

    return result;
  },
};
