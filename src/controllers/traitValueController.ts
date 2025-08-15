import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../../custom";
import { CustomError } from "../exceptions/CustomError";
import { traitValueServices } from "../services/traitValueServices";
import { traitValueRepository } from "../repositories/traitValueRepository";
import { traitTypeRepository } from "../repositories/traitTypeRepository";
import { collectionRepository } from "../repositories/collectionRepository";
import { db } from "../utils/db";
import { v4 as uuidv4 } from "uuid";
import { uploadToS3 } from "../utils/aws";
import { randomUUID } from "crypto";
import sharp from "sharp";
import logger from "@config/winston";
import { queueService, QueueType } from "../queue/queueService";
import { AxiosError } from "axios";
import { orderRepository } from "@repositories/orderRepostory";
import { collectionProgressRepository } from "@repositories/collectionProgressRepository";
import { collectionUploadSessionRepository } from "@repositories/collectionUploadSessionRepository";
import { Insertable } from "kysely";
import { TraitValue } from "@app-types/db/types";
import { encryption } from "@utils/KeyEncryption";
import { layerRepository } from "@repositories/layerRepository";
import { PSBTBuilder } from "@blockchain/bitcoin/PSBTBuilder";
import { deleteStoredInscriptionId } from "@queue/queueProcessServiceAPIs";

export interface traitValueParams {
  type: string;
  value: string;
  zIndex: number;
  file?: Express.Multer.File;
  fileKey?: string;
}

export const traitValueController = {
  /**
   * Inter-service endpoint: Get trait value details by id regardless of status/soft deletion
   */
  getRandomTraitValueByCollectionIdForService: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectionId } = req.params;

      const selectedTraitValue =
        await traitValueRepository.getRandomItemByCollectionId(collectionId);
      if (!selectedTraitValue)
        return res.status(200).json({ success: true, data: null });
      const traitValue = await traitValueRepository.setShortHoldById(
        selectedTraitValue.id
      );
      if (!traitValue)
        return res.status(200).json({ success: true, data: null });

      return res.status(200).json({ success: true, data: selectedTraitValue });
    } catch (e) {
      next(e);
    }
  },
  /**
   * Inter-service endpoint: Update trait value inscriptionId
   */
  updateTraitValueInscription: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { traitValueId, inscriptionId, lockingAddress, lockingPrivateKey } =
        req.body;
      if (
        !traitValueId ||
        !inscriptionId ||
        !lockingAddress ||
        !lockingPrivateKey
      ) {
        throw new CustomError(
          "traitValueId, inscriptionId, lockingAddress and lockingPrivateKey are required",
          400
        );
      }

      const traitValue = await traitValueRepository.getById(traitValueId);
      if (!traitValue) throw new CustomError("Invalid trait value id", 400);
      if (
        traitValue.inscriptionId ||
        traitValue.lockingAddress ||
        traitValue.lockingPrivateKey
      )
        throw new CustomError("Trait value has already been processed", 400);

      const layer = await layerRepository.getByTraitValueId(traitValue.id);

      const psbtBuilder = new PSBTBuilder(
        layer.network === "MAINNET" ? "mainnet" : "testnet"
      );
      const txid = inscriptionId.slice(0, 64);
      const isExistingTransaction = await psbtBuilder.getTransaction(txid);
      if (!isExistingTransaction) {
        await deleteStoredInscriptionId(inscriptionId);
        throw new CustomError(`Inscribing transaction not found: ${txid}`, 400);
      }

      const encryptedData = encryption.encrypt(lockingPrivateKey);
      const updated = await traitValueRepository.updateById(traitValueId, {
        inscriptionId,
        lockingAddress,
        lockingPrivateKey: encryptedData.encrypted,
        iv: encryptedData.iv,
        authTag: encryptedData.authTag
      });

      return res.status(200).json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  },
  /**
   * Inter-service endpoint: Get count of not-done trait values (no inscriptionId) for a collection
   */
  getNotDoneTraitValueCountByCollectionId: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectionId } = req.params;
      const count = await traitValueRepository.getNotDoneCountByCollectionId(
        collectionId
      );
      return res.status(200).json({ success: true, data: { count } });
    } catch (e) {
      next(e);
    }
  },
  getTraitValuesByTraitTypeId: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { traitTypeId } = req.params;

      const result =
        await traitValueRepository.getTraitValuesWithCountByTraitTypeId(
          traitTypeId
        );

      return res
        .status(200)
        .json({ success: true, data: { traitTypes: result } });
    } catch (e) {
      next(e);
    }
  },
  createTraitValue: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user;
      const { traitTypeId } = req.body;
      const files = req.files as Express.Multer.File[];
      if (!user) throw new CustomError("Unauthorized", 401);
      if (!traitTypeId || !files || files.length === 0) {
        throw new CustomError(
          "Invalid input: traitTypeId and files are required",
          400
        );
      }

      // Fetch trait type to get collectionId
      const traitType = await traitTypeRepository.getById(traitTypeId);
      if (!traitType) throw new CustomError("Trait type not found", 404);
      const collectionId = traitType.collectionId;
      // Fetch collection
      const collection = await collectionRepository.getById(db, collectionId);
      if (!collection) throw new CustomError("Collection not found", 404);
      // Permission check
      if (collection.creatorId !== user.id && user.role !== "SUPER_ADMIN") {
        throw new CustomError(
          "Forbidden: Not collection creator or super admin",
          403
        );
      }

      const order =
        await orderRepository.getOrderByCollectionIdAndMintRecursiveCollectibleType(
          collectionId
        );
      if (!order) throw new CustomError("Order not found", 400);
      if (!order.fundingAddress)
        throw new CustomError("Order does not have funding address", 400);
      const collectionProgress = await collectionProgressRepository.getById(
        collectionId
      );
      if (!collectionProgress)
        throw new CustomError("Collection progress not found", 400);
      if (!collectionProgress.paymentCompleted)
        throw new CustomError("Please fund the order first", 400);
      if (collectionProgress.queued)
        throw new CustomError(
          "Collection has already been queued for processing.",
          400
        );

      const collectionUploadSession =
        await collectionUploadSessionRepository.getById(collectionId);
      if (!collectionUploadSession)
        throw new CustomError("Collection upload session not found", 400);
      if (
        collectionUploadSession.expectedTraitValues <
        Number(collectionUploadSession.traitValueCount) + files.length
      )
        throw new CustomError(
          "Number of existing trait value exceeded the expected amount",
          400
        );

      if (!collection.recursiveHeight || !collection.recursiveWidth) {
        const metadata = await sharp(files[0].buffer).metadata();

        await collectionRepository.update(db, collection.id, {
          recursiveHeight: metadata.height,
          recursiveWidth: metadata.width
        });
      }
      // Upload files to S3 in batch
      const fileKeys = await Promise.all(
        files.map(async (file) => {
          const key = randomUUID().toString();
          if (file) await uploadToS3(key, file);
          return {
            key,
            fileName: file.originalname,
            fileSize: file.size
          };
        })
      );
      // Parse and format values from file names
      const traitValuesToInsert: Insertable<TraitValue>[] = fileKeys.map(
        ({ key, fileName, fileSize }) => {
          const value = fileName
            .split(".")[0]
            .replace(/\s+/g, "_")
            .toLowerCase();
          return {
            value,
            fileKey: key,
            traitTypeId,
            fileSizeInBytes: fileSize
          };
        }
      );

      const result = await traitValueRepository.bulkInsert(traitValuesToInsert);

      return res
        .status(200)
        .json({ success: true, data: { traitValues: result } });
    } catch (e) {
      next(e);
    }
  }
};
