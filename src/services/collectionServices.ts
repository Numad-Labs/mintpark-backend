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
    const key = randomUUID();
    await uploadToS3(key, file);

    data.logoKey = key;
    data.ownerAddress = issuerId;
    console.log(data);
    const collection = await collectionRepository.create(data, db);

    return collection;
  },
};
