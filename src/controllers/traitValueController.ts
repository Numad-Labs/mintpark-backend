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
import { queueService } from "../services/queueService";

export interface traitValueParams {
  type: string;
  value: string;
  zIndex: number;
  file?: Express.Multer.File;
  fileKey?: string;
}

export const traitValueController = {
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
            fileName: file.originalname
          };
        })
      );
      // Parse and format values from file names
      const traitValuesToInsert = fileKeys.map(({ key, fileName }) => {
        const value = fileName.split(".")[0].replace(/\s+/g, "_").toLowerCase();
        return {
          value,
          fileKey: key,
          traitTypeId
        };
      });

      // Save to DB
      const result = await traitValueRepository.bulkInsert(traitValuesToInsert);

      // Enqueue each trait value for IPFS processing
      await Promise.all(
        result.map(async (traitValue) => {
          try {
            await queueService.enqueueIpfsUpload(
              traitValue.id,
              collectionId,
              traitValue.fileKey
            );
            logger.info(
              `Enqueued trait value: ${traitValue.id} to IPFS Processor Queue`
            );
            
            // Also enqueue for inscription processing
            await queueService.enqueueInscription(
              traitValue.id,
              collectionId,
              'trait'
            );
            logger.info(
              `Enqueued trait value: ${traitValue.id} to Inscription Processor Queue`
            );
          } catch (error) {
            logger.error(
              `Failed to enqueue trait value ${traitValue.id}:`,
              error
            );
          }
        })
      );

      return res
        .status(200)
        .json({ success: true, data: { traitValues: result } });
    } catch (e) {
      next(e);
    }
  }
};
