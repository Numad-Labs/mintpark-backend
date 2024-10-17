import { randomUUID } from "crypto";
import { launchRepository } from "../repositories/launchRepository";
import { Launch } from "@prisma/client";
import { uploadToS3 } from "../utils/aws";
import { launchItemRepository } from "../repositories/launchItemRepository";
import { collectionRepository } from "../repositories/collectionRepository";

export const launchServices = {
  create: async (data: any, files: Express.Multer.File[]) => {
    const collection = await collectionRepository.getById(data.collectionId);
    if (!collection) throw new Error("Collection not found.");

    if (collection.type === "LAUNCHED")
      throw new Error("Collection already launched.");

    if (files.length < 1)
      throw new Error("Launch must have at least one file.");
    const launch = await launchRepository.create(data);

    const launchItems = await createLaunchItems(launch.id, files);

    const updatedCollection = await collectionRepository.update(collection.id, {
      type: "LAUNCHED",
      supply: collection.supply + launchItems.length,
    });

    return { launch, updatedCollection, launchItems };
  },
};

async function createLaunchItems(
  launchId: string,
  files: Express.Multer.File[]
): Promise<any[]> {
  return await Promise.all(
    files.map(async (file) => {
      const key = randomUUID();
      await uploadToS3(key, file);
      return await launchItemRepository.create({
        launchId,
        fileKey: key,
      });
    })
  );
}
