import { collectibleTraitRepository } from "../repositories/collectibleTraitRepository";
import { traitTypeRepository } from "../repositories/traitTypeRepository";
import { traitValueRepository } from "../repositories/traitValueRepository";
import { collectionRepository } from "../repositories/collectionRepository";
import { CustomError } from "../exceptions/CustomError";
import { db } from "../utils/db";
import { Insertable } from "kysely";
import { TraitType, TraitValue, CollectibleTrait } from "../types/db/types";
import { collectibleRepository } from "@repositories/collectibleRepository";
import { userRepository } from "@repositories/userRepository";
import logger from "@config/winston";
import { redis } from "../";
import { randomUUID } from "crypto";

export interface BatchTraitData {
  collectibleId: string;
  traits: Array<{
    trait_type: string;
    value: string;
  }>;
}

export const collectibleTraitServices = {
  insertTraits: async (
    collectibleId: string,
    traits: {
      trait_type: string;
      value: string;
    }[]
  ) => {
    const collectible = await collectibleRepository.getById(db, collectibleId);
    if (!collectible) throw new CustomError("Collectible not found", 400);

    const traitTypesToInsert: Insertable<TraitType>[] = [];
    const traitValuesToInsert: Insertable<TraitValue>[] = [];
    const collectibleTraitsToInsert: Insertable<CollectibleTrait>[] = [];

    // Redis TTL for trait caching (24 hours)
    const TRAIT_CACHE_TTL = 24 * 60 * 60;

    for (let trait of traits) {
      const traitValueCacheKey = `trait_value:${collectible.collectionId}:${trait.trait_type}:${trait.value}`;

      // Check Redis cache first
      let traitValueId = await redis.get(traitValueCacheKey);

      if (!traitValueId) {
        // Check if trait value exists in database
        const existingTraitValue =
          await traitValueRepository.getByTraitTypeAndValueAndCollectionId(
            collectible.collectionId,
            trait.trait_type,
            trait.value
          );

        if (existingTraitValue) {
          traitValueId = existingTraitValue.id;
          // Cache the existing trait value ID
          await redis.setex(traitValueCacheKey, TRAIT_CACHE_TTL, traitValueId);
        } else {
          // Need to create trait value, first check/create trait type
          const traitTypeCacheKey = `trait_type:${collectible.collectionId}:${trait.trait_type}`;
          let traitTypeId = await redis.get(traitTypeCacheKey);

          if (!traitTypeId) {
            const existingTraitType =
              await traitTypeRepository.getByNameAndCollectionId(
                trait.trait_type,
                collectible.collectionId
              );

            if (existingTraitType) {
              traitTypeId = existingTraitType.id;
              // Cache the existing trait type ID
              await redis.setex(
                traitTypeCacheKey,
                TRAIT_CACHE_TTL,
                traitTypeId
              );
            } else {
              // Generate new trait type ID and cache it
              traitTypeId = randomUUID(); // or whatever ID generation method you use

              traitTypesToInsert.push({
                id: traitTypeId,
                name: trait.trait_type,
                collectionId: collectible.collectionId,
                zIndex: 0
              });

              // Cache the new trait type ID (will be valid after insert)
              await redis.setex(
                traitTypeCacheKey,
                TRAIT_CACHE_TTL,
                traitTypeId
              );
            }
          }

          // Generate new trait value ID
          traitValueId = randomUUID(); // or whatever ID generation method you use

          traitValuesToInsert.push({
            id: traitValueId,
            value: trait.value,
            traitTypeId: traitTypeId,
            fileKey: ""
          });

          // Cache the new trait value ID (will be valid after insert)
          await redis.setex(traitValueCacheKey, TRAIT_CACHE_TTL, traitValueId);
        }
      }

      collectibleTraitsToInsert.push({
        collectibleId,
        traitValueId
      });
    }

    // Perform bulk inserts in transaction for consistency
    await db.transaction().execute(async (trx) => {
      if (traitTypesToInsert.length > 0) {
        await traitTypeRepository.bulkInsert(traitTypesToInsert);
      }

      if (traitValuesToInsert.length > 0) {
        await traitValueRepository.bulkInsert(traitValuesToInsert);
      }

      if (collectibleTraitsToInsert.length > 0) {
        await collectibleTraitRepository.bulkInsert(collectibleTraitsToInsert);
      }
    });

    return true;
  },
  createBatchTraits: async (
    collectionId: string,
    batchData: BatchTraitData[],
    issuerId?: string
  ) => {
    if (batchData.length > 10) {
      throw new CustomError("Maximum batch size is 10 collectibles", 400);
    }

    // Verify collection exists and user has access
    const collection = await collectionRepository.getById(db, collectionId);
    if (!collection) {
      throw new CustomError("Collection not found", 404);
    }
    if (!collection.creatorId) {
      throw new CustomError("Collection has no creator", 403);
    }

    // // Check if user is admin/super_admin or the creator of the collection
    // if (!issuerId) {
    //   throw new CustomError("Requester ID is required", 400);
    // }
    // const user = await userRepository.getById(issuerId);
    // if (!user) {
    //   throw new CustomError("User not found", 404);
    // }
    // // Only allow non-users or collection
    // if (collection.creatorId !== user.id && user.role === "USER") {
    //   throw new CustomError(
    //     "You don't have permission to update this collection",
    //     403
    //   );
    // }

    // Process all collectibles and their traits in a transaction
    return await db.transaction().execute(async (trx) => {
      // Get all collectible IDs from the batch data
      const collectibleIds = batchData.map((item) => item.collectibleId);

      // Use repository function with "in" query to get collectibles that exist and belong to the collection
      const collectibles =
        await collectibleRepository.getCollectiblesByIdsAndCollectionId(
          trx,
          collectibleIds,
          collectionId
        );

      // Find invalid collectible IDs (those that don't exist or don't belong to the collection)
      const validCollectibleIds = new Set(collectibles.map((c) => c.id));
      const invalidCollectibles = collectibleIds.filter(
        (id) => !validCollectibleIds.has(id)
      );

      if (invalidCollectibles.length > 0) {
        throw new CustomError(
          `Collectibles not found in collection ${collectionId}: ${invalidCollectibles.join(
            ", "
          )}`,
          404
        );
      }

      // Get all existing trait types for this collection
      const existingTraitTypes =
        await traitTypeRepository.getTraitTypesByCollectionId(collectionId);

      // Initialize trait type map with existing trait types
      const traitTypeMap = new Map<string, string>();
      for (const tt of existingTraitTypes) {
        const id = tt.id?.toString();
        const name = tt.name;
        if (typeof id === "string" && typeof name === "string") {
          traitTypeMap.set(name.toLowerCase(), id);
        }
      }

      // Prepare new trait types to be created
      const newTraitTypes: Array<Insertable<TraitType>> = [];
      const uniqueTraitTypes = new Set(
        batchData.flatMap((item) =>
          item.traits.map((t) => t.trait_type.trim().toLowerCase())
        )
      );

      for (const traitType of uniqueTraitTypes) {
        if (!traitTypeMap.has(traitType)) {
          const newTraitTypeId = crypto.randomUUID();
          const newTraitType: Insertable<TraitType> = {
            id: newTraitTypeId,
            name: traitType,
            collectionId,
            zIndex: 0
          };
          newTraitTypes.push(newTraitType);
          traitTypeMap.set(traitType, newTraitTypeId);
        }
      }

      // Bulk insert new trait types if any
      if (newTraitTypes.length > 0) {
        await traitTypeRepository.bulkInsert(newTraitTypes);
      }

      // Get all existing trait values for the trait types
      const validTraitTypeIds = Array.from(traitTypeMap.values());
      const existingTraitValuesPromises = validTraitTypeIds.map(
        async (traitTypeId) => {
          try {
            // Ensure we have a valid string ID
            if (typeof traitTypeId !== "string") {
              console.error(`Invalid trait type ID: ${traitTypeId}`);
              return null;
            }
            return await traitValueRepository.getByTraitTypeIdAndValue(
              traitTypeId,
              ""
            );
          } catch (error) {
            console.error(
              `Error fetching trait values for trait type ${traitTypeId}:`,
              error
            );
            return null;
          }
        }
      );

      const existingTraitValues = (
        await Promise.all(existingTraitValuesPromises)
      ).filter(Boolean);

      const traitValueMap = new Map<string, string>();
      existingTraitValues.flat().forEach((tv) => {
        // Ensure we have valid string values for id, traitTypeId and value
        const id = tv?.id?.toString();
        const traitTypeId = tv?.traitTypeId?.toString();
        const value = tv?.value?.toString();
        if (id && traitTypeId && value) {
          const key = `${traitTypeId}_${value.toLowerCase()}`;
          traitValueMap.set(key, id);
        }
      });

      // Prepare new trait values to be created
      const newTraitValues: Array<Insertable<TraitValue>> = [];
      const processedTraitValues = new Set<string>();

      // Extract and validate all trait types first
      const traitTypeValidationMap = new Map<string, string>();
      for (const { traits } of batchData) {
        for (const { trait_type } of traits) {
          const normalizedType = trait_type.trim().toLowerCase();
          const traitTypeId = traitTypeMap.get(normalizedType);
          if (!traitTypeId || typeof traitTypeId !== "string") {
            throw new CustomError(
              `Trait type ${normalizedType} not found in collection ${collectionId}`,
              400
            );
          }
          traitTypeValidationMap.set(normalizedType, traitTypeId);
        }
      }

      // Now process trait values with validated trait types
      for (const { traits } of batchData) {
        for (const { trait_type, value } of traits) {
          const normalizedType = trait_type.trim().toLowerCase();
          const normalizedValue = value.trim();
          const traitTypeId = traitTypeValidationMap.get(normalizedType);

          // This check is redundant but TypeScript needs it
          if (!traitTypeId || typeof traitTypeId !== "string") {
            throw new CustomError(
              `Trait type ${normalizedType} not found in collection ${collectionId}`,
              400
            );
          }

          const key = `${traitTypeId}_${normalizedValue.toLowerCase()}`;

          if (!traitValueMap.has(key) && !processedTraitValues.has(key)) {
            const newTraitValueId = crypto.randomUUID();
            const newTraitValue: Insertable<TraitValue> = {
              id: newTraitValueId,
              traitTypeId,
              value: normalizedValue,
              fileKey: ""
            };
            newTraitValues.push(newTraitValue);
            traitValueMap.set(key, newTraitValueId);
            processedTraitValues.add(key);
          }
        }
      }

      // Bulk insert new trait values if any
      if (newTraitValues.length > 0) {
        await traitValueRepository.bulkInsert(newTraitValues);
      }

      // Get existing collectible traits to avoid duplicates
      const existingTraits = await Promise.all(
        collectibleIds.map((id) =>
          collectibleTraitRepository.getByCollectibleId(id)
        )
      );

      const existingTraitsMap = new Map();
      existingTraits.forEach((traits, index) => {
        const collectibleId = collectibleIds[index];
        traits.forEach((trait) => {
          existingTraitsMap.set(`${collectibleId}_${trait.value}`, true);
        });
      });

      // Prepare new collectible traits
      const collectibleTraits: Insertable<CollectibleTrait>[] = [];

      for (const { collectibleId, traits } of batchData) {
        for (const { trait_type, value } of traits) {
          const normalizedType = trait_type.trim().toLowerCase();
          const normalizedValue = value.trim();
          const traitTypeId = traitTypeMap.get(normalizedType);

          if (!traitTypeId) {
            throw new CustomError(
              `Trait type ${normalizedType} not found in collection ${collectionId}`,
              400
            );
          }

          const traitValueId = traitValueMap.get(
            `${traitTypeId}_${normalizedValue.toLowerCase()}`
          );

          if (!traitValueId) {
            throw new CustomError(
              `Trait value ${normalizedValue} not found for trait type ${normalizedType}`,
              400
            );
          }

          if (!existingTraitsMap.has(`${collectibleId}_${normalizedValue}`)) {
            collectibleTraits.push({
              id: crypto.randomUUID(),
              collectibleId,
              traitValueId
            });
          }
        }
      }

      // Bulk insert new collectible traits
      if (collectibleTraits.length > 0) {
        await collectibleTraitRepository.bulkInsert(collectibleTraits);
      }

      return {
        success: true,
        message: `Successfully processed ${batchData.length} collectibles`,
        traitTypesCreated: newTraitTypes.length,
        traitValuesCreated: newTraitValues.length,
        traitsAssigned: collectibleTraits.length
      };
    });
  }
};
