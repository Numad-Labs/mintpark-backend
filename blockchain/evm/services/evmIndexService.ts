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
          console.log(
            "🚀 ~ EVMCollectibleService ~ getOwnedTokens ~ ownerAddress:",
            ownerAddress
          );
          const tokenId = await contract.tokenOfOwnerByIndex(ownerAddress, i);
          console.log(
            "🚀 ~ EVMCollectibleService ~ getOwnedTokens ~ tokenId:",
            tokenId
          );
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

  //saved to use. Can be used on get collection owner's cound in batch. But didn't tested
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
      .leftJoin("List", (join) =>
        join
          .on("List.collectibleId", "=", "Collectible.id")
          .on("List.status", "=", "ACTIVE")
      )
      .select([
        "Collectible.id",
        "Collectible.uniqueIdx",
        "Collectible.fileKey",
        "Collectible.collectionId",
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
