import { ethers, BytesLike, EventLog, Contract } from "ethers";
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
    if (!ethers.isAddress(contractAddress)) {
      throw new CustomError(
        `Invalid contract address: ${contractAddress}`,
        400
      );
    }
    if (!ethers.isAddress(ownerAddress)) {
      throw new CustomError(`Invalid owner address: ${ownerAddress}`, 400);
    }
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
      // return this.getOwnedTokensByEvents(contract, ownerAddress);

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

  // Fallback method using events
  private async getOwnedTokensByEvents(
    contract: Contract,
    ownerAddress: string
  ): Promise<string[]> {
    try {
      // Get transfer events
      const filter = contract.filters.Transfer(null, ownerAddress);
      const events = await contract.queryFilter(filter);

      // Get unique token IDs
      const tokenIds = new Set<string>();

      for (const event of events) {
        // Check if event is EventLog (has args) or Log (doesn't have args)
        if (event instanceof EventLog) {
          const tokenId = event.args[2]; // Third argument is tokenId
          if (tokenId) {
            try {
              // Check if the owner still owns this token
              const currentOwner = await contract.ownerOf(tokenId);
              if (currentOwner.toLowerCase() === ownerAddress.toLowerCase()) {
                tokenIds.add(tokenId.toString());
              }
            } catch (error) {
              console.warn(
                `Failed to verify ownership of token ${tokenId}:`,
                error
              );
            }
          }
        } else {
          // Handle old-style logs
          const decodedData = contract.interface.parseLog({
            topics: event.topics,
            data: event.data,
          });

          if (decodedData?.args) {
            const tokenId = decodedData.args[2]; // Third argument is tokenId
            if (tokenId) {
              try {
                const currentOwner = await contract.ownerOf(tokenId);
                if (currentOwner.toLowerCase() === ownerAddress.toLowerCase()) {
                  tokenIds.add(tokenId.toString());
                }
              } catch (error) {
                console.warn(
                  `Failed to verify ownership of token ${tokenId}:`,
                  error
                );
              }
            }
          }
        }
      }

      return Array.from(tokenIds);
    } catch (error) {
      console.error("Failed to get tokens by events:", error);
      return [];
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
      query = query.where("Collection.id", "in", collectionIds);
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
