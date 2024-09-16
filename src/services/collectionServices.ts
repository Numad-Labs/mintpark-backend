import { Insertable } from "kysely";
import { Collection } from "../types/db/types";

import { collectionRepository } from "../repositories/collectionRepository";
import { db } from "../utils/db";
import { CustomError } from "../exceptions/CustomError";
import { uploadToS3 } from "../utils/aws";
import { randomUUID } from "crypto";

export const collectionServices = {
  create: async (
    data: Insertable<Collection>,
    file: Express.Multer.File,
    issuerId: string
  ) => {
    if (data.ticker.length > 7)
      throw new CustomError("Invalid ticker length.", 400);

    const key = randomUUID();
    await uploadToS3(key, file);

    data.logoKey = key;
    data.userId = issuerId;
    const collection = await collectionRepository.create(data, db);

    return collection;
  },
};
