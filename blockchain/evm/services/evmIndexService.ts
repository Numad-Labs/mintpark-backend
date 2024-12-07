import { ethers, BytesLike, EventLog, Contract, Log } from "ethers";
import { EVM_CONFIG } from "../evm-config";
import { db } from "../../../src/utils/db";
import { CustomError } from "../../../src/exceptions/CustomError";
import { NFTActivity, NFTActivityType } from "../evm-types";

export class EVMCollectibleService {
  private provider: ethers.JsonRpcProvider;
  private BLOCK_RANGE = 1000;
  private BATCH_SIZE = 5; // Process collections in batches
  private DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches

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
      // Create contract instance
      const contract = new ethers.Contract(
        contractAddress,
        EVM_CONFIG.NFT_CONTRACT_ABI,
        this.provider
      );

      const balance = await contract.balanceOf(ownerAddress);
      console.log(
        "🚀 ~ EVMCollectibleService ~ getOwnedTokens ~ balance:",
        balance
      );
      const balanceNumber = Number(balance);

      if (balanceNumber === 0) {
        return [];
      }

      const allTokenIds: string[] = [];

      // Process one token at a time to prevent concurrent requests
      for (let i = 0; i < balanceNumber; i++) {
        try {
          const tokenId = await contract.tokenOfOwnerByIndex(ownerAddress, i);
          allTokenIds.push(tokenId.toString());

          // Add a small delay between individual token requests
          if (i > 0 && i % 5 === 0) {
            // Add delay every 5 tokens
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (error: any) {
          console.error(`Failed to get token at index ${i}:`, error);
          continue;
        }
      }

      return allTokenIds;
    } catch (error) {
      console.error(`Error in getOwnedTokens for ${ownerAddress}:`, error);

      if (error instanceof CustomError) {
        throw error;
      }
      throw error; // Re-throw other errors
    }
  }

  async processCollections(collections: string[], ownerAddress: string) {
    const results: Record<string, string[]> = {};
    const CONCURRENT_COLLECTIONS = 5; // Process 5 collections at a time

    // Process collections in groups
    for (let i = 0; i < collections.length; i += CONCURRENT_COLLECTIONS) {
      const batch = collections.slice(i, i + CONCURRENT_COLLECTIONS);
      const batchPromises = batch.map(async (contractAddress) => {
        try {
          const tokens = await this.getOwnedTokens(
            contractAddress,
            ownerAddress
          );
          return { contractAddress, tokens };
        } catch (error) {
          console.error(
            `Error processing collection ${contractAddress}:`,
            error
          );
          return { contractAddress, tokens: [] };
        }
      });

      // Wait for the current batch to complete
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ contractAddress, tokens }) => {
        results[contractAddress] = tokens;
      });

      // Add delay between collection batches
      if (i + CONCURRENT_COLLECTIONS < collections.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  async getCollectionOwnersCount(contractAddress: string): Promise<number> {
    if (!ethers.isAddress(contractAddress)) {
      throw new CustomError(
        `Invalid contract address: ${contractAddress}`,
        400
      );
    }

    try {
      const contract = new Contract(
        contractAddress,
        EVM_CONFIG.NFT_CONTRACT_ABI,
        this.provider
      );

      // Get total supply of tokens
      const totalSupply = await contract.totalSupply();
      const totalSupplyNum = Number(totalSupply);

      // Use Set to track unique owners
      const uniqueOwners = new Set<string>();

      // Process tokens in batches to avoid rate limiting
      for (let i = 0; i < totalSupplyNum; i++) {
        try {
          // Get the actual token ID at this index
          const tokenId = await contract.tokenByIndex(i);

          // Get the owner of this token
          const owner = await contract.ownerOf(tokenId);
          uniqueOwners.add(owner.toLowerCase());

          // Add delay every BATCH_SIZE tokens
          if ((i + 1) % this.BATCH_SIZE === 0) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        } catch (err: unknown) {
          // const error = err as ContractError;

          // // Check if the contract doesn't support ERC721Enumerable
          // if (
          //   i === 0 &&
          //   error.message &&
          //   error.message.includes("tokenByIndex")
          // ) {
          //   throw new CustomError(
          //     "Contract doesn't support ERC721Enumerable interface",
          //     400
          //   );
          // }

          console.error(`Error fetching owner for index ${i}:`, err);
          continue; // Skip failed tokens
        }
      }

      return uniqueOwners.size;
    } catch (error) {
      console.error(
        `Error getting owners count for ${contractAddress}:`,
        error
      );
      throw error;
    }
  }

  async getAllCollectionsOwnersCount(
    contractAddresses: string[]
  ): Promise<Record<string, number>> {
    const results: Record<string, number> = {};

    // Process collections in batches
    for (let i = 0; i < contractAddresses.length; i += this.BATCH_SIZE) {
      const batch = contractAddresses.slice(i, i + this.BATCH_SIZE);
      const batchPromises = batch.map(async (address) => {
        try {
          const count = await this.getCollectionOwnersCount(address);
          return { address, count };
        } catch (error) {
          console.error(`Error processing collection ${address}:`, error);
          return { address, count: 0 };
        }
      });

      // Wait for current batch to complete
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ address, count }) => {
        results[address] = count;
      });

      // Add delay between batches
      if (i + this.BATCH_SIZE < contractAddresses.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.DELAY_BETWEEN_BATCHES)
        );
      }
    }

    return results;
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

  private async getPaginatedLogs(
    filter: any,
    fromBlock: number,
    toBlock: number
  ): Promise<Log[]> {
    const logs: Log[] = [];
    let currentFromBlock = fromBlock;

    while (currentFromBlock <= toBlock) {
      const currentToBlock = Math.min(
        currentFromBlock + this.BLOCK_RANGE - 1,
        toBlock
      );

      try {
        const blockLogs = await this.provider.getLogs({
          ...filter,
          fromBlock: currentFromBlock,
          toBlock: currentToBlock,
        });
        logs.push(...blockLogs);
      } catch (error) {
        console.error(
          `Error fetching logs for blocks ${currentFromBlock}-${currentToBlock}:`,
          error
        );
      }

      currentFromBlock = currentToBlock + 1;
    }

    return logs;
  }
  // async getActivityByTokenId(
  //   nftContractAddress: string,
  //   tokenId: string,
  //   fromBlock: number = 0
  // ): Promise<NFTActivity[]> {
  //   const activities: NFTActivity[] = [];
  //   const nftContract = new ethers.Contract(
  //     nftContractAddress,
  //     EVM_CONFIG.NFT_CONTRACT_ABI,
  //     this.provider
  //   );

  //   const marketplaceContract = new ethers.Contract(
  //     EVM_CONFIG.MARKETPLACE_ADDRESS,
  //     EVM_CONFIG.MARKETPLACE_ABI,
  //     this.provider
  //   );

  //   // Get mint events
  //   const mintFilter = nftContract.filters.Transfer(
  //     ethers.ZeroAddress,
  //     null,
  //     tokenId
  //   );
  //   const mintLogs = await this.provider.getLogs({
  //     ...mintFilter,
  //     fromBlock,
  //   });

  //   // Get transfer events (excluding mints)
  //   const transferFilter = nftContract.filters.Transfer(null, null, tokenId);
  //   const transferLogs = await this.provider.getLogs({
  //     ...transferFilter,
  //     fromBlock,
  //   });

  //   // Get listing events
  //   const listingFilter = marketplaceContract.filters.ItemListed(
  //     null,
  //     nftContractAddress,
  //     tokenId
  //   );
  //   const listingLogs = await this.provider.getLogs({
  //     ...listingFilter,
  //     fromBlock,
  //   });

  //   // Get sale events
  //   const saleFilter = marketplaceContract.filters.ItemSold(
  //     null,
  //     null,
  //     nftContractAddress,
  //     tokenId
  //   );
  //   const saleLogs = await this.provider.getLogs({
  //     ...saleFilter,
  //     fromBlock,
  //   });

  //   // Get listing cancellation events
  //   const cancelFilter = marketplaceContract.filters.ListingCancelled(
  //     null,
  //     nftContractAddress,
  //     tokenId
  //   );
  //   const cancelLogs = await this.provider.getLogs({
  //     ...cancelFilter,
  //     fromBlock,
  //   });

  //   // Process mint events
  //   for (const log of mintLogs) {
  //     const eventArgs = await this.processEventLog(
  //       log,
  //       nftContract,
  //       "Transfer"
  //     );
  //     if (eventArgs) {
  //       const block = await this.provider.getBlock(log.blockNumber);
  //       const timestamp = block ? Number(block.timestamp) : 0;

  //       activities.push({
  //         activityType: NFTActivityType.MINTED,
  //         tokenId,
  //         collectionId: nftContractAddress,
  //         fromAddress: ethers.ZeroAddress,
  //         toAddress: eventArgs[1],
  //         transactionHash: log.transactionHash,
  //         timestamp,
  //         blockNumber: log.blockNumber,
  //       });
  //     }
  //   }

  //   // Process transfer events (excluding mints)
  //   for (const log of transferLogs) {
  //     const eventArgs = await this.processEventLog(
  //       log,
  //       nftContract,
  //       "Transfer"
  //     );
  //     if (eventArgs && eventArgs[0] !== ethers.ZeroAddress) {
  //       const block = await this.provider.getBlock(log.blockNumber);
  //       const timestamp = block ? Number(block.timestamp) : 0;

  //       activities.push({
  //         activityType: NFTActivityType.TRANSFER,
  //         tokenId,
  //         collectionId: nftContractAddress,
  //         fromAddress: eventArgs[0],
  //         toAddress: eventArgs[1],
  //         transactionHash: log.transactionHash,
  //         timestamp,
  //         blockNumber: log.blockNumber,
  //       });
  //     }
  //   }

  //   // Process listing events
  //   for (const log of listingLogs) {
  //     const eventArgs = await this.processEventLog(
  //       log,
  //       marketplaceContract,
  //       "ItemListed"
  //     );
  //     if (eventArgs) {
  //       const block = await this.provider.getBlock(log.blockNumber);
  //       const timestamp = block ? Number(block.timestamp) : 0;

  //       activities.push({
  //         activityType: NFTActivityType.LISTED,
  //         tokenId,
  //         collectionId: nftContractAddress,
  //         fromAddress: eventArgs[0],
  //         price: eventArgs[3].toString(),
  //         transactionHash: log.transactionHash,
  //         timestamp,
  //         blockNumber: log.blockNumber,
  //       });
  //     }
  //   }

  //   // Process sale events
  //   for (const log of saleLogs) {
  //     const eventArgs = await this.processEventLog(
  //       log,
  //       marketplaceContract,
  //       "ItemSold"
  //     );
  //     if (eventArgs) {
  //       const block = await this.provider.getBlock(log.blockNumber);
  //       const timestamp = block ? Number(block.timestamp) : 0;

  //       activities.push({
  //         activityType: NFTActivityType.SALE,
  //         tokenId,
  //         collectionId: nftContractAddress,
  //         fromAddress: eventArgs[0],
  //         toAddress: eventArgs[1],
  //         price: eventArgs[4].toString(),
  //         transactionHash: log.transactionHash,
  //         timestamp,
  //         blockNumber: log.blockNumber,
  //       });
  //     }
  //   }

  //   // Process cancellation events
  //   for (const log of cancelLogs) {
  //     const eventArgs = await this.processEventLog(
  //       log,
  //       marketplaceContract,
  //       "ListingCancelled"
  //     );
  //     if (eventArgs) {
  //       const block = await this.provider.getBlock(log.blockNumber);
  //       const timestamp = block ? Number(block.timestamp) : 0;

  //       activities.push({
  //         activityType: NFTActivityType.LISTING_CANCELED,
  //         tokenId,
  //         collectionId: nftContractAddress,
  //         fromAddress: eventArgs[0],
  //         transactionHash: log.transactionHash,
  //         timestamp,
  //         blockNumber: log.blockNumber,
  //       });
  //     }
  //   }

  //   // Sort activities by timestamp (newest first)
  //   return activities.sort((a, b) => b.timestamp - a.timestamp);
  // }
  async getActivityByTokenId(
    nftContractAddress: string,
    tokenId: string,
    fromBlock: number = 0
  ): Promise<NFTActivity[]> {
    const activities: NFTActivity[] = [];

    try {
      const latestBlock = await this.provider.getBlockNumber();

      const nftContract = new ethers.Contract(
        nftContractAddress,
        EVM_CONFIG.NFT_CONTRACT_ABI,
        this.provider
      );

      const marketplaceContract = new ethers.Contract(
        EVM_CONFIG.MARKETPLACE_ADDRESS,
        EVM_CONFIG.MARKETPLACE_ABI,
        this.provider
      );

      // Get all events and filter afterwards
      const [transferLogs, listingLogs, saleLogs, cancelLogs] =
        await Promise.all([
          // All Transfer events for the contract
          this.getPaginatedLogs(
            {
              address: nftContractAddress,
              topics: [ethers.id("Transfer(address,address,uint256)")],
            },
            fromBlock,
            latestBlock
          ),
          // All ItemListed events
          this.getPaginatedLogs(
            {
              address: EVM_CONFIG.MARKETPLACE_ADDRESS,
              topics: [
                ethers.id("ItemListed(address,address,uint256,uint256)"),
              ],
            },
            fromBlock,
            latestBlock
          ),
          // All ItemSold events
          this.getPaginatedLogs(
            {
              address: EVM_CONFIG.MARKETPLACE_ADDRESS,
              topics: [
                ethers.id("ItemSold(address,address,address,uint256,uint256)"),
              ],
            },
            fromBlock,
            latestBlock
          ),
          // All ListingCancelled events
          this.getPaginatedLogs(
            {
              address: EVM_CONFIG.MARKETPLACE_ADDRESS,
              topics: [ethers.id("ListingCancelled(address,address,uint256)")],
            },
            fromBlock,
            latestBlock
          ),
        ]);

      // Process Transfer events
      for (const log of transferLogs) {
        const eventArgs = await this.processEventLog(
          log,
          nftContract,
          "Transfer"
        );
        if (eventArgs && eventArgs[2].toString() === tokenId) {
          const block = await this.provider.getBlock(log.blockNumber);
          const timestamp = block ? Number(block.timestamp) : 0;

          // Check if it's a mint (from zero address)
          if (eventArgs[0] === ethers.ZeroAddress) {
            activities.push({
              activityType: NFTActivityType.MINTED,
              tokenId,
              collectionId: nftContractAddress,
              fromAddress: ethers.ZeroAddress,
              toAddress: eventArgs[1],
              transactionHash: log.transactionHash,
              timestamp,
              blockNumber: log.blockNumber,
            });
          } else {
            activities.push({
              activityType: NFTActivityType.TRANSFER,
              tokenId,
              collectionId: nftContractAddress,
              fromAddress: eventArgs[0],
              toAddress: eventArgs[1],
              transactionHash: log.transactionHash,
              timestamp,
              blockNumber: log.blockNumber,
            });
          }
        }
      }

      // Process Listing events
      for (const log of listingLogs) {
        const eventArgs = await this.processEventLog(
          log,
          marketplaceContract,
          "ItemListed"
        );
        if (
          eventArgs &&
          eventArgs[1].toLowerCase() === nftContractAddress.toLowerCase() &&
          eventArgs[2].toString() === tokenId
        ) {
          const block = await this.provider.getBlock(log.blockNumber);
          const timestamp = block ? Number(block.timestamp) : 0;

          activities.push({
            activityType: NFTActivityType.LISTED,
            tokenId,
            collectionId: nftContractAddress,
            fromAddress: eventArgs[0],
            price: eventArgs[3].toString(),
            transactionHash: log.transactionHash,
            timestamp,
            blockNumber: log.blockNumber,
          });
        }
      }

      // Process Sale events
      for (const log of saleLogs) {
        const eventArgs = await this.processEventLog(
          log,
          marketplaceContract,
          "ItemSold"
        );
        if (
          eventArgs &&
          eventArgs[2].toLowerCase() === nftContractAddress.toLowerCase() &&
          eventArgs[3].toString() === tokenId
        ) {
          const block = await this.provider.getBlock(log.blockNumber);
          const timestamp = block ? Number(block.timestamp) : 0;

          activities.push({
            activityType: NFTActivityType.SALE,
            tokenId,
            collectionId: nftContractAddress,
            fromAddress: eventArgs[0],
            toAddress: eventArgs[1],
            price: eventArgs[4].toString(),
            transactionHash: log.transactionHash,
            timestamp,
            blockNumber: log.blockNumber,
          });
        }
      }

      // Process Cancel events
      for (const log of cancelLogs) {
        const eventArgs = await this.processEventLog(
          log,
          marketplaceContract,
          "ListingCancelled"
        );
        if (
          eventArgs &&
          eventArgs[1].toLowerCase() === nftContractAddress.toLowerCase() &&
          eventArgs[2].toString() === tokenId
        ) {
          const block = await this.provider.getBlock(log.blockNumber);
          const timestamp = block ? Number(block.timestamp) : 0;

          activities.push({
            activityType: NFTActivityType.LISTING_CANCELED,
            tokenId,
            collectionId: nftContractAddress,
            fromAddress: eventArgs[0],
            transactionHash: log.transactionHash,
            timestamp,
            blockNumber: log.blockNumber,
          });
        }
      }

      // Sort activities by timestamp (newest first)
      return activities.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error("Error fetching NFT activities:", error);
      throw error;
    }
  }

  // async getActivityByCollection(
  //   nftContractAddress: string,
  //   fromBlock: number = 0
  // ): Promise<NFTActivity[]> {
  //   const activities: NFTActivity[] = [];
  //   const nftContract = new ethers.Contract(
  //     nftContractAddress,
  //     EVM_CONFIG.NFT_CONTRACT_ABI,
  //     this.provider
  //   );

  //   const marketplaceContract = new ethers.Contract(
  //     EVM_CONFIG.MARKETPLACE_ADDRESS,
  //     EVM_CONFIG.MARKETPLACE_ABI,
  //     this.provider
  //   );

  //   // Get mint events
  //   const mintFilter = nftContract.filters.Transfer(ethers.ZeroAddress, null);
  //   const mintEvents = await nftContract.queryFilter(mintFilter, fromBlock);

  //   // Get transfer events (excluding mints)
  //   const transferFilter = nftContract.filters.Transfer(null, null);
  //   const transferEvents = await nftContract.queryFilter(
  //     transferFilter,
  //     fromBlock
  //   );

  //   // Get listing events
  //   const listingFilter = marketplaceContract.filters.ItemListed(
  //     null,
  //     nftContractAddress
  //   );
  //   const listingEvents = await marketplaceContract.queryFilter(
  //     listingFilter,
  //     fromBlock
  //   );

  //   // Get sale events
  //   const saleFilter = marketplaceContract.filters.ItemSold(
  //     null,
  //     null,
  //     nftContractAddress
  //   );
  //   const saleEvents = await marketplaceContract.queryFilter(
  //     saleFilter,
  //     fromBlock
  //   );

  //   // Get listing cancellation events
  //   const cancelFilter = marketplaceContract.filters.ListingCancelled(
  //     null,
  //     nftContractAddress
  //   );
  //   const cancelEvents = await marketplaceContract.queryFilter(
  //     cancelFilter,
  //     fromBlock
  //   );

  //   // Process mint events
  //   for (const event of mintEvents) {
  //     const block = await event.getBlock();
  //     activities.push({
  //       activityType: NFTActivityType.MINTED,
  //       tokenId: null,
  //       collectionId: nftContractAddress,
  //       fromAddress: ethers.ZeroAddress,
  //       toAddress: event.args?.[1],
  //       transactionHash: event.transactionHash,
  //       timestamp: block.timestamp,
  //       blockNumber: event.blockNumber,
  //     });
  //   }

  //   // Process transfer events (excluding mints)
  //   for (const event of transferEvents) {
  //     if (event.args?.[0] !== ethers.ZeroAddress) {
  //       const block = await event.getBlock();
  //       activities.push({
  //         activityType: NFTActivityType.TRANSFER,
  //         tokenId: null,
  //         collectionId: nftContractAddress,
  //         fromAddress: event.args?.[0],
  //         toAddress: event.args?.[1],
  //         transactionHash: event.transactionHash,
  //         timestamp: block.timestamp,
  //         blockNumber: event.blockNumber,
  //       });
  //     }
  //   }

  //   // Process listing events
  //   for (const event of listingEvents) {
  //     const block = await event.getBlock();
  //     activities.push({
  //       activityType: NFTActivityType.LISTED,
  //       tokenId: null,
  //       collectionId: nftContractAddress,
  //       fromAddress: event.args?.[0],
  //       price: event.args?.[3].toString(),
  //       transactionHash: event.transactionHash,
  //       timestamp: block.timestamp,
  //       blockNumber: event.blockNumber,
  //     });
  //   }

  //   // Process sale events
  //   for (const event of saleEvents) {
  //     const block = await event.getBlock();
  //     activities.push({
  //       activityType: NFTActivityType.SALE,
  //       tokenId: null,
  //       collectionId: nftContractAddress,
  //       fromAddress: event.args?.[0],
  //       toAddress: event.args?.[1],
  //       price: event.args?.[4].toString(),
  //       transactionHash: event.transactionHash,
  //       timestamp: block.timestamp,
  //       blockNumber: event.blockNumber,
  //     });
  //   }

  //   // Process cancellation events
  //   for (const event of cancelEvents) {
  //     const block = await event.getBlock();
  //     activities.push({
  //       activityType: NFTActivityType.LISTING_CANCELED,
  //       tokenId: null,
  //       collectionId: nftContractAddress,
  //       fromAddress: event.args?.[0],
  //       transactionHash: event.transactionHash,
  //       timestamp: block.timestamp,
  //       blockNumber: event.blockNumber,
  //     });
  //   }

  //   // Sort activities by timestamp (newest first)
  //   return activities.sort((a, b) => b.timestamp - a.timestamp);
  // }

  private async processEventLog(
    log: Log,
    contract: ethers.Contract,
    eventName: string
  ) {
    const iface = new ethers.Interface(contract.interface.formatJson());
    try {
      const parsedLog = iface.parseLog({
        topics: log.topics,
        data: log.data,
      });

      return parsedLog?.args;
    } catch (error) {
      console.error(`Error parsing ${eventName} event:`, error);
      return null;
    }
  }
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
