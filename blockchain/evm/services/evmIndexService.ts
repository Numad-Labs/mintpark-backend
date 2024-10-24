import { ethers, BytesLike } from "ethers";
import { EVM_CONFIG } from "../evm-config";
import { db } from "../../../src/utils/db";
import { CustomError } from "../../../src/exceptions/CustomError";

interface MulticallResponse {
  success: boolean;
  returnData: string;
}

export class EVMCollectibleService {
  private provider: ethers.JsonRpcProvider;

  constructor(providerUrl: string) {
    this.provider = new ethers.JsonRpcProvider(providerUrl);
  }

  async getOwnedTokens(contractAddress: string, ownerAddress: string) {
    try {
      // Validate inputs
      if (!ethers.isAddress(contractAddress)) {
        throw new CustomError(
          `Invalid contract address: ${contractAddress}`,
          400
        );
      }
      if (!ethers.isAddress(ownerAddress)) {
        throw new CustomError(`Invalid owner address: ${ownerAddress}`, 400);
      }

      // Create contract instance
      const contract = new ethers.Contract(
        contractAddress,
        EVM_CONFIG.NFT_CONTRACT_ABI,
        this.provider
      );

      const balance = await contract.balanceOf(ownerAddress);
      const balanceNumber = Number(balance);

      if (balanceNumber === 0) {
        return [];
      }

      // Get all token IDs
      const tokenPromises = [];
      for (let i = 0; i < Number(balance); i++) {
        tokenPromises.push(
          contract
            .tokenOfOwnerByIndex(ownerAddress, i)
            .then((tokenId: bigint) => tokenId.toString())
            .catch((error: any) => {
              console.error(`Failed to get token at index ${i}:`, error);
              return null;
            })
        );
      }

      const tokenIds = await Promise.all(tokenPromises);
      return tokenIds.filter((id): id is string => id !== null);
    } catch (error) {
      console.error(`Error in getOwnedTokens for ${ownerAddress}:`, error);

      if (error instanceof CustomError) {
        throw error;
      }
    }
  }
  async getEVMCollections(collectionIds?: string[]) {
    let query = db
      .selectFrom("Collection")
      .select([
        "id",
        "name",
        "contractAddress",
        "supply",
        "description",
        "logoKey",
      ])
      .where("contractAddress", "is not", null);

    console.log(collectionIds);

    if (collectionIds?.length) {
      query = query.where((eb) =>
        eb("Collection.id", "in", [
          "02424158-f089-4a95-b341-0fb1f02f7573",
          "02424158-f089-4a95-b341-0fb1f02f7573",
        ])
      );
    }

    const collections = await query.execute();

    return collections;
  }
  async getCollectibleDetails(collectionId: string, tokenIds: string[]) {
    const collectibles = await db
      .selectFrom("Collectible")
      .leftJoin(
        "CollectibleTrait",
        "CollectibleTrait.collectibleId",
        "Collectible.id"
      )
      .leftJoin("Trait", "Trait.id", "CollectibleTrait.traitId")
      .leftJoin("List", (join) =>
        join
          .on("List.collectibleId", "=", "Collectible.id")
          .on("List.status", "=", "ACTIVE")
      )
      .select([
        "Collectible.id",
        "Collectible.name",
        "Collectible.uniqueIdx",
        "Collectible.fileKey",
        "Collectible.collectionId",
        "Trait.name as traitName",
        "CollectibleTrait.value",
        "CollectibleTrait.rarity",
        "List.price",
      ])
      .where("Collectible.collectionId", "=", collectionId)
      .where("Collectible.uniqueIdx", "in", tokenIds)
      .execute();

    // Group by collectible and organize traits
    return this.organizeCollectiblesAndTraits(collectibles);
  }

  organizeCollectiblesAndTraits(rawData: any[]) {
    const collectiblesMap = new Map();

    rawData.forEach((row) => {
      if (!collectiblesMap.has(row.id)) {
        collectiblesMap.set(row.id, {
          id: row.id,
          name: row.name,
          uniqueIdx: row.uniqueIdx,
          fileKey: row.fileKey,
          collectionId: row.collectionId,
          traits: [],
          isListed: !!row.price,
          price: row.price,
        });
      }

      if (row.traitName) {
        const collectible = collectiblesMap.get(row.id)!;
        collectible.traits.push({
          trait: { name: row.traitName },
          value: row.value,
          rarity: row.rarity,
        });
      }
    });

    return Array.from(collectiblesMap.values());
  }
  //  applyFiltersAndSort(
  //   collectibles: Collectible[],
  //   params: CollectibleQueryParams
  // ): Collectible[] {
  //   let filtered = [...collectibles];

  //   if (params.isListed !== undefined) {
  //     filtered = filtered.filter((c) => c.isListed === params.isListed);
  //   }

  //   if (params.orderBy) {
  //     filtered.sort((a, b) => {
  //       const direction = params.orderDirection === "desc" ? -1 : 1;
  //       if (params.orderBy === "price") {
  //         const priceA = a.price ? parseFloat(a.price) : 0;
  //         const priceB = b.price ? parseFloat(b.price) : 0;
  //         return (priceA - priceB) * direction;
  //       }
  //       return (
  //         (parseInt(a.uniqueIdx) - parseInt(b.uniqueIdx)) * direction
  //       );
  //     });
  //   }

  //   return filtered;
  // }
}

// // Controller implementation
// export const evmCollectibleController = {
//   getListableCollectibles: async (
//     req: Request<{ userId: string }, {}, {}, CollectibleQueryParams>,
//     res: Response,
//     next: NextFunction
//   ) => {
//     try {
//       const { userId } = req.params;
//       const { isListed = false, orderBy, orderDirection, collectionIds } = req.query;

//       // Get user's address from database
//       const user = await db
//         .selectFrom("User")
//         .select(["address"])
//         .where("id", "=", userId)
//         .executeTakeFirst();

//       if (!user) {
//         throw new Error("User not found");
//       }

//       const service = new EVMCollectibleService(process.env.EVM_RPC_URL!);
//       const result = await service.getListableCollectibles(
//         userId,
//         user.address,
//         {
//           isListed,
//           orderBy,
//           orderDirection,
//           collectionIds
//         }
//       );

//       return res.status(200).json({
//         success: true,
//         data: result
//       });
//     } catch (error) {
//       next(error);
//     }
//   }
// };
