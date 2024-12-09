import { randomUUID } from "crypto";
import { traitTypeRepository } from "../repositories/traitTypeRepository";
import { traitValueRepository } from "../repositories/traitValueRepository";
import { uploadToS3 } from "../utils/aws";
import { orderRepository } from "../repositories/orderRepostory";
import { CustomError } from "../exceptions/CustomError";
import { traitValueParams } from "../controllers/traitValueController";

export const traitValueServices = {
  create: async (userId: string, data: traitValueParams) => {
    const order = await orderRepository.getByCollectionId(data.collectionId);
    if (order?.userId !== userId)
      throw new CustomError(
        "You are not allowed to create trait value for this collection.",
        400
      );

    //TODO: Add validation to check if order.fundingAddress was funded(>=order.fundingAmount) or not
    const isPaid = true;
    if (!isPaid)
      throw new CustomError("Fee has not been transferred yet.", 400);

    data.type.toUpperCase();
    data.value.toUpperCase();
    let traitType = await traitTypeRepository.getByNameAndCollectionId(
      data.type,
      data.collectionId
    );
    if (!traitType)
      traitType = await traitTypeRepository.create({
        name: data.type,
        collectionId: data.collectionId,
        zIndex: data.zIndex,
      });

    const fileKey = await randomUUID();
    await uploadToS3(fileKey, data.file);
    const traitValue = await traitValueRepository.create({
      value: data.value,
      traitTypeId: traitType.id,
      fileKey: fileKey,
    });

    return { traitValue };
  },
};
