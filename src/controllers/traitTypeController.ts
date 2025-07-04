import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../../custom";
import { CustomError } from "../exceptions/CustomError";
import { traitTypeRepository } from "../repositories/traitTypeRepository";
import { db } from "../utils/db";
import { collectionRepository } from "../repositories/collectionRepository";
import { v4 as uuidv4 } from "uuid";
import { orderRepository } from "@repositories/orderRepostory";
import { getBalance } from "@blockchain/bitcoin/libs";

export const traitTypeController = {
  getTraitTypesByCollectionId: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { collectionId } = req.params;

      const result = await traitTypeRepository.getTraitTypesByCollectionId(
        collectionId
      );

      return res
        .status(200)
        .json({ success: true, data: { traitTypes: result } });
    } catch (e) {
      next(e);
    }
  },
  createTraitTypes: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user;
      const { collectionId, data } = req.body;
      if (!user) throw new CustomError("Unauthorized", 401);
      if (!collectionId || !Array.isArray(data)) {
        throw new CustomError(
          "Invalid input: collectionId and data are required",
          400
        );
      }
      if (data.length > 10) {
        throw new CustomError("Too many trait types", 400);
      }

      const order =
        await orderRepository.getOrderByCollectionIdAndMintRecursiveCollectibleType(
          collectionId
        );
      if (!order) throw new CustomError("Order not found", 400);
      if (!order.fundingAddress)
        throw new CustomError("Order does not have funding address", 400);
      const balance = await getBalance(order.fundingAddress);
      if (balance < order.fundingAmount)
        throw new CustomError("Please fund the order first", 400);

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
      // Validate and format data
      const traitTypesToInsert = data.map((item: any) => {
        if (!item.name || typeof item.zIndex !== "number") {
          throw new CustomError(
            "Each trait type must have a name and zIndex",
            400
          );
        }
        const formattedName = item.name.replace(/\s+/g, "_").toLowerCase();
        return {
          name: formattedName,
          zIndex: item.zIndex,
          collectionId
        };
      });
      // Save to DB
      const result = await traitTypeRepository.bulkInsert(traitTypesToInsert);

      // Return all trait types for the collection
      return res
        .status(200)
        .json({ success: true, data: { traitTypes: result } });
    } catch (e) {
      next(e);
    }
  }
};
