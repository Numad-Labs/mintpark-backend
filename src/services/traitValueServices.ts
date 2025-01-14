import { randomUUID } from "crypto";
import { traitTypeRepository } from "../repositories/traitTypeRepository";
import { traitValueRepository } from "../repositories/traitValueRepository";
import { uploadToS3 } from "../utils/aws";
import { orderRepository } from "../repositories/orderRepostory";
import { CustomError } from "../exceptions/CustomError";
import { traitValueParams } from "../controllers/traitValueController";
import { userRepository } from "../repositories/userRepository";
import { collectionRepository } from "../repositories/collectionRepository";
import { db } from "../utils/db";
import { Insertable } from "kysely";
import { TraitType, TraitValue } from "../types/db/types";

export const traitValueServices = {
  create: async (
    userId: string,
    userLayerId: string,
    collectionId: string,
    data: traitValueParams[],
    files: Express.Multer.File[]
  ) => {
    const collection = await collectionRepository.getById(db, collectionId);
    if (!collection) throw new CustomError("Collection not found.", 400);
    if (
      collection.creatorId !== userId ||
      collection.creatorUserLayerId !== userLayerId
    )
      throw new CustomError(
        "You are not allowed to create trait value for this collection.",
        400
      );
    if (collection.type !== "RECURSIVE_INSCRIPTION")
      throw new CustomError(
        "You cannot create trait value for this type of collection.",
        400
      );

    const order = await orderRepository.getByCollectionId(collectionId);
    if (order?.userId !== userId)
      throw new CustomError(
        "You are not allowed to create trait value for this collection.",
        400
      );

    const user = await userRepository.getByUserLayerId(userLayerId);
    if (!user) throw new CustomError("Invalid user layer.", 400);
    if (!user.isActive)
      throw new CustomError("This account has been deactivated.", 400);

    //TODO: validation to check if order.fundingAddress was funded(>=order.fundingAmount) or not
    const isPaid = true;
    if (!isPaid)
      throw new CustomError("Fee has not been transferred yet.", 400);

    const fileKeys = [];
    const promises = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const key = randomUUID().toString();

      fileKeys[i] = { key };
      if (file) {
        promises.push(uploadToS3(key, file));
      }
    }
    await Promise.all(promises);

    const traitTypeData: Insertable<TraitType>[] = [];
    const traitValueData: Insertable<TraitValue>[] = [];
    for (let i = 0; i < data.length; i++) {
      data[i].type = data[i].type.toLowerCase();
      data[i].value = data[i].value.toLowerCase();

      const isExistingTraitType =
        await traitTypeRepository.getByNameAndCollectionId(
          data[i].type,
          collectionId
        );

      let traitTypeId = randomUUID().toString();
      if (
        !isExistingTraitType &&
        !traitTypeData.some((traitType) => traitType.name === data[i].type)
      )
        traitTypeData.push({
          id: traitTypeId,
          name: data[i].type,
          collectionId: collectionId,
          zIndex: data[i].zIndex,
        });
      else if (isExistingTraitType) {
        traitTypeId = isExistingTraitType.id;
      } else if (
        traitTypeData.some((traitType) => traitType.name === data[i].type)
      ) {
        const matchingTraitType = traitTypeData.find(
          (traitType) => traitType.name === data[i].type
        );

        if (matchingTraitType && matchingTraitType.id)
          traitTypeId = matchingTraitType?.id;
      }

      const isExistingTraitValue =
        await traitValueRepository.getByNameValueAndCollectionId(
          data[i].type,
          data[i].value,
          collection.id
        );

      if (
        !isExistingTraitValue &&
        !traitValueData.some((traitValue) => traitValue.value === data[i].value)
      )
        traitValueData.push({
          traitTypeId,
          value: data[i].value,
          fileKey: fileKeys[i].key,
        });
    }

    let traitTypes, traitValues;
    if (traitTypeData.length > 0) {
      traitTypes = await traitTypeRepository.bulkInsert(traitTypeData);
    }

    if (traitValueData.length > 0) {
      traitValues = await traitValueRepository.bulkInsert(traitValueData);
    }

    return { traitTypes, traitValues };
  },
};
