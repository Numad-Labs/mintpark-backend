import { Insertable } from "kysely";
import { Collectible } from "../types/db/types";
import { collectionRepository } from "../repositories/collectionRepository";
import { CustomError } from "../exceptions/CustomError";
import { uploadToS3 } from "../utils/aws";
import { randomUUID } from "crypto";
import { db } from "../utils/db";
import { collectibleRepository } from "../repositories/collectibleRepository";

export const collectibleServices = {
  create: async (
    data: Insertable<Collectible>[],
    files: Express.Multer.File[],
    userId: string
  ) => {
    const collection = await collectionRepository.getById(data[0].collectionId);

    if (!collection) throw new CustomError("Collection does not exist.", 400);

    for (let i = 1; i < data.length; i++) {
      if (data[i].collectionId !== data[i - 1].collectionId)
        throw new CustomError(
          "Collectibles with different collectionIds.",
          400
        );
    }

    if (collection.userId !== userId)
      throw new CustomError("You are not authorized.", 403);

    const collectibles: Insertable<Collectible>[] = [];

    if (collection.totalCount + files.length > collection.supply)
      throw new CustomError("Collection supply exceeded.", 400);

    for (let i = 0; i < files.length; i++) {
      const key = randomUUID();
      await uploadToS3(key, files[i]);

      data[i].fileKey = key;
      data[i].name = `${collection.name} #${i}`;

      collectibles.push(data[i]);
    }

    const createdCollectibles = await collectibleRepository.create(
      collectibles,
      db
    );

    collection.totalCount += data.length;
    await collectionRepository.update(collection.id, collection);

    return createdCollectibles;
  },
};
