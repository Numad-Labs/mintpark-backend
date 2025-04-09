import { ethers } from "ethers";
import { CustomError } from "../../../../exceptions/CustomError";
import { EVM_CONFIG } from "../../evm-config";
import { config } from "../../../../config/config";
import { BaseNFTService } from "./baseNFTService";
import { redis } from "../../../../index";
import logger from "../../../../config/winston";
import {
  getContractVersionConfig,
  DEFAULT_CONTRACT_VERSION,
  CONTRACT_VERSIONS,
  CONTRACT_VERSIONS_ENUM
} from "../../contract-versions";

export class DirectMintNFTService extends BaseNFTService {
  private readonly DOMAIN_NAME = "UnifiedNFT";
  private readonly DOMAIN_VERSION = "1";
  private readonly MAX_ROYALTY_FEE = 1000; // 10%
  private readonly MAX_PLATFORM_FEE = 1000; // 10%
  private readonly MIN_CONTRACT_NAME_LENGTH = 1;
  private readonly MAX_CONTRACT_NAME_LENGTH = 50;
  private readonly MIN_SYMBOL_LENGTH = 1;
  private readonly MAX_SYMBOL_LENGTH = 10;

  // Store contract version information
  private contractVersion: string;
  private versionConfig: any;
  private networkCache: { chainId: bigint } | null = null;

  constructor(
    rpcUrl: string,
    contractVersion: string = DEFAULT_CONTRACT_VERSION
  ) {
    super(rpcUrl);

    // Set the contract version and retrieve version config
    this.contractVersion = contractVersion;

    if (!CONTRACT_VERSIONS[contractVersion]) {
      throw new CustomError(
        `Unsupported contract version: ${contractVersion}`,
        400
      );
    }

    this.versionConfig = CONTRACT_VERSIONS[contractVersion];
  }

  async validateUpdatePhaseParams(
    collectionAddress: string,
    phaseIndex: number,
    phaseType: number,
    price: bigint,
    startTime: number,
    endTime: number,
    maxSupply: number,
    maxPerWallet: number,
    from: string
  ) {
    // Validate collection address
    if (!ethers.isAddress(collectionAddress)) {
      throw new CustomError("Invalid collection address", 400);
    }

    // Validate from address
    if (!ethers.isAddress(from)) {
      throw new CustomError("Invalid from address", 400);
    }

    if (from === ethers.ZeroAddress) {
      throw new CustomError("From address cannot be zero address", 400);
    }

    // Validate phase index
    if (phaseIndex < 0) {
      throw new CustomError("Phase index cannot be negative", 400);
    }

    // Check if the phase exists
    const contract = new ethers.Contract(
      collectionAddress,
      EVM_CONFIG.DIRECT_MINT_NFT_ABI,
      this.provider
    );

    const phaseCount = await contract.getPhaseCount();
    if (BigInt(phaseIndex) >= phaseCount) {
      throw new CustomError("Invalid phase index", 400);
    }

    // Validate phase type
    if (![0, 1, 2].includes(phaseType)) {
      // 1: Whitelist, 2: FCFS,  3:Public
      throw new CustomError("Invalid phase type", 400);
    }
    // Validate time range
    if (startTime >= endTime) {
      throw new CustomError("Start time must be before end time", 400);
    }

    // Validate price
    try {
      const priceInEther = price;
      if (priceInEther < BigInt(0)) {
        throw new CustomError("Price cannot be negative", 400);
      }
    } catch {
      throw new CustomError("Invalid price format", 400);
    }

    // Validate max per wallet for non-public phases
    if (phaseType !== 2 && maxPerWallet <= 0) {
      // 2 = PUBLIC
      throw new CustomError(
        "Max per wallet must be positive for non-public phases",
        400
      );
    }
  }

  async validatePhaseUpdate(
    contractAddress: string,
    phaseIndex: number,
    phaseType: number,
    price: bigint,
    startTime: number,
    endTime: number,
    maxSupply: number,
    maxPerWallet: number
  ) {
    try {
      const contract = new ethers.Contract(
        contractAddress,
        EVM_CONFIG.DIRECT_MINT_NFT_ABI,
        this.provider
      );

      // Get existing phase data
      const existingPhase = await contract.phases(phaseIndex);

      // Check if any parameters actually changed
      const priceChanged =
        existingPhase.price !== ethers.parseEther(price.toString());
      const startTimeChanged =
        BigInt(existingPhase.startTime) !== BigInt(startTime);
      const endTimeChanged = BigInt(existingPhase.endTime) !== BigInt(endTime);
      const maxSupplyChanged =
        BigInt(existingPhase.maxSupply) !== BigInt(maxSupply);
      const maxPerWalletChanged =
        BigInt(existingPhase.maxPerWallet) !== BigInt(maxPerWallet);
      const phaseTypeChanged =
        BigInt(existingPhase.phaseType) !== BigInt(phaseType);

      // Check all other phases for overlaps
      const phaseCount = await contract.getPhaseCount();
      for (let i = 0; i < Number(phaseCount); i++) {
        if (i === phaseIndex) continue;

        const otherPhase = await contract.phases(i);
        const otherStart = Number(otherPhase.startTime);
        const otherEnd = Number(otherPhase.endTime);

        if (
          (startTime < otherEnd || otherEnd === 0) &&
          (endTime > otherStart || endTime === 0)
        ) {
          return {
            success: false,
            error: `Overlaps with phase ${i}`,
            overlappingPhase: {
              index: i,
              start: otherStart,
              end: otherEnd
            }
          };
        }
      }

      return {
        success: true,
        changedParameters: {
          priceChanged,
          startTimeChanged,
          endTimeChanged,
          maxSupplyChanged,
          maxPerWalletChanged,
          phaseTypeChanged
        },
        originalPhase: {
          phaseType: Number(existingPhase.phaseType),
          price: ethers.formatEther(existingPhase.price),
          startTime: Number(existingPhase.startTime),
          endTime: Number(existingPhase.endTime),
          maxSupply: Number(existingPhase.maxSupply),
          maxPerWallet: Number(existingPhase.maxPerWallet)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error || "Unknown error"
      };
    }
  }

  async validateDeploymentParams(
    initialOwner: string,
    contractName: string,
    symbol: string,
    royaltyFee: number,
    platformFee: number
  ) {
    if (!ethers.isAddress(initialOwner)) {
      throw new CustomError("Invalid initial owner address", 400);
    }

    if (initialOwner === ethers.ZeroAddress) {
      throw new CustomError("Initial owner cannot be zero address", 400);
    }

    if (
      !contractName ||
      contractName.length < this.MIN_CONTRACT_NAME_LENGTH ||
      contractName.length > this.MAX_CONTRACT_NAME_LENGTH
    ) {
      throw new CustomError(
        `Contract name must be between ${this.MIN_CONTRACT_NAME_LENGTH} and ${this.MAX_CONTRACT_NAME_LENGTH} characters`,
        400
      );
    }

    if (
      !symbol ||
      symbol.length < this.MIN_SYMBOL_LENGTH ||
      symbol.length > this.MAX_SYMBOL_LENGTH
    ) {
      throw new CustomError(
        `Symbol must be between ${this.MIN_SYMBOL_LENGTH} and ${this.MAX_SYMBOL_LENGTH} characters`,
        400
      );
    }

    if (royaltyFee < 0 || royaltyFee > this.MAX_ROYALTY_FEE) {
      throw new CustomError(
        `Royalty fee must be between 0 and ${this.MAX_ROYALTY_FEE} (${
          this.MAX_ROYALTY_FEE / 100
        }%)`,
        400
      );
    }

    if (platformFee < 0 || platformFee > this.MAX_PLATFORM_FEE) {
      throw new CustomError(
        `Platform fee must be between 0 and ${this.MAX_PLATFORM_FEE} (${
          this.MAX_PLATFORM_FEE / 100
        }%)`,
        400
      );
    }
  }

  async getUnsignedDeploymentTransaction(
    initialOwner: string,
    contractName: string,
    symbol: string,
    royaltyFee: number,
    platformFee: number
  ) {
    try {
      await this.validateDeploymentParams(
        initialOwner,
        contractName,
        symbol,
        royaltyFee,
        platformFee
      );

      const factory = new ethers.ContractFactory(
        this.versionConfig.directMintNftAbi,
        this.versionConfig.directMintNftBytecode,
        this.provider
      );

      const unsignedTx = await factory.getDeployTransaction(
        initialOwner,
        contractName,
        symbol,
        royaltyFee,
        platformFee,
        config.PLATFORM_FEE_RECIPIENT,
        config.VAULT_ADDRESS
      );
      return this.prepareUnsignedTransaction(unsignedTx, initialOwner);
    } catch (error) {
      logger.error(error);
    }
  }

  async generateMintSignature(
    collectionAddress: string,
    minterAddress: string,
    tokenId: string,
    uri: string,
    price: string,
    phaseIndex: number
  ) {
    // await this.validateMintParams(
    //   collectionAddress,
    //   minterAddress,
    //   tokenId,
    //   uri,
    //   price,
    //   phaseIndex
    // );
    const { chainId } = await this.getNetwork();

    const backendPrivateKey = config.VAULT_PRIVATE_KEY;
    const domain = {
      name: "UnifiedNFT",
      version: "1",
      chainId: chainId,
      verifyingContract: collectionAddress
    };

    const uniqueId = ethers.keccak256(
      ethers.solidityPacked(
        ["address", "uint256", "string", "uint256"],
        [minterAddress, tokenId, uri, Date.now()]
      )
    );

    const timestamp = Math.floor(Date.now() / 1000);

    // Types differ between v2 and v3
    let types: any;
    let value: any;

    if (this.contractVersion === CONTRACT_VERSIONS_ENUM.V2) {
      // V2 includes timestamp in the signature
      types = {
        MintRequest: [
          { name: "minter", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "uri", type: "string" },
          { name: "price", type: "uint256" },
          { name: "phaseIndex", type: "uint256" },
          { name: "uniqueId", type: "bytes32" },
          { name: "timestamp", type: "uint256" }
        ]
      };

      value = {
        minter: minterAddress,
        tokenId: tokenId,
        uri: uri,
        price: ethers.parseEther(price),
        phaseIndex: phaseIndex,
        uniqueId: uniqueId,
        timestamp: timestamp
      };
    } else {
      // V3 doesn't include timestamp in the signature
      types = {
        MintRequest: [
          { name: "minter", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "uri", type: "string" },
          { name: "price", type: "uint256" },
          { name: "phaseIndex", type: "uint256" },
          { name: "uniqueId", type: "bytes32" }
        ]
      };

      value = {
        minter: minterAddress,
        tokenId: tokenId,
        uri: uri,
        price: ethers.parseEther(price),
        phaseIndex: phaseIndex,
        uniqueId: uniqueId
      };
    }
    const backendWallet = new ethers.Wallet(backendPrivateKey, this.provider);
    const signature = await backendWallet.signTypedData(domain, types, value);

    return { signature, uniqueId, timestamp };
  }

  async verifySignature(
    collectionAddress: string,
    signature: string,
    chainId: bigint,
    params: {
      minter: string;
      tokenId: string;
      uri: string;
      price: string;
      phaseIndex: number;
      uniqueId: string;
      timestamp?: number;
    }
  ) {
    // Type definitions differ between versions
    let types: any;
    let value: any;

    if (this.contractVersion === CONTRACT_VERSIONS_ENUM.V2) {
      if (!params.timestamp) {
        throw new CustomError(
          "Timestamp required for v2.0 signature verification",
          400
        );
      }

      types = {
        MintRequest: [
          { name: "minter", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "uri", type: "string" },
          { name: "price", type: "uint256" },
          { name: "phaseIndex", type: "uint256" },
          { name: "uniqueId", type: "bytes32" },
          { name: "timestamp", type: "uint256" }
        ]
      };

      value = {
        minter: params.minter,
        tokenId: params.tokenId,
        uri: params.uri,
        price: ethers.parseEther(params.price),
        phaseIndex: params.phaseIndex,
        uniqueId: params.uniqueId,
        timestamp: params.timestamp
      };
    } else {
      types = {
        MintRequest: [
          { name: "minter", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "uri", type: "string" },
          { name: "price", type: "uint256" },
          { name: "phaseIndex", type: "uint256" },
          { name: "uniqueId", type: "bytes32" }
        ]
      };

      value = {
        minter: params.minter,
        tokenId: params.tokenId,
        uri: params.uri,
        price: ethers.parseEther(params.price),
        phaseIndex: params.phaseIndex,
        uniqueId: params.uniqueId
      };
    }

    const domain = {
      name: this.DOMAIN_NAME,
      version: this.DOMAIN_VERSION,
      chainId: Number(chainId),
      verifyingContract: collectionAddress
    };

    const recoveredAddress = ethers.verifyTypedData(
      domain,
      types,
      value,
      signature
    );

    if (recoveredAddress.toLowerCase() !== config.VAULT_ADDRESS.toLowerCase()) {
      throw new CustomError("Invalid signature", 400);
    }
  }
  async getUnsignedMintTransaction(
    collectionAddress: string,
    tokenId: string,
    uri: string,
    price: string,
    uniqueId: string,
    timestamp: number,
    signature: string,
    from: string
  ): Promise<ethers.TransactionRequest> {
    try {
      const phaseInfo = await this.getActivePhase(collectionAddress);
      if (!phaseInfo.isActive) {
        throw new CustomError("No active phase found", 400);
      }

      const contract = new ethers.Contract(
        collectionAddress,
        this.versionConfig.directMintNftAbi,
        this.provider
      );

      try {
        const { chainId } = await this.getNetwork();

        await this.verifySignature(collectionAddress, signature, chainId, {
          minter: from,
          tokenId,
          uri,
          price,
          phaseIndex: phaseInfo.phaseIndex,
          timestamp,
          uniqueId
        });
      } catch (error) {
        throw new CustomError(`Invalid signature: ${error}`, 400);
      }

      let unsignedTx;

      if (this.contractVersion === CONTRACT_VERSIONS_ENUM.V2) {
        // V2 requires merkleProof and timestamp
        const emptyMerkleProof: string[] = [];

        unsignedTx = await contract.mint.populateTransaction(
          tokenId,
          uri,
          uniqueId,
          timestamp,
          signature,
          emptyMerkleProof, // For public sales, empty merkle proof is fine
          { value: ethers.parseEther(price) }
        );
      } else {
        // V3 doesn't require merkleProof or timestamp in the transaction
        unsignedTx = await contract.mint.populateTransaction(
          tokenId,
          uri,
          uniqueId,
          signature,
          { value: ethers.parseEther(price) }
        );
      }

      return this.prepareUnsignedTransaction(unsignedTx, from);
    } catch (error) {
      throw new CustomError(`Failed to create mint transaction: ${error}`, 500);
    }
  }

  // The rest of the phase and fee management methods remain unchanged
  async getUnsignedAddPhaseTransaction(
    collectionAddress: string,
    phaseType: number,
    price: string,
    startTime: number,
    endTime: number,
    maxSupply: number,
    maxPerWallet: number,
    // merkleRoot: string,
    from: string
  ): Promise<ethers.TransactionRequest> {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        this.versionConfig.directMintNftAbi,
        this.provider
      );

      let unsignedTx;

      if (this.contractVersion === CONTRACT_VERSIONS_ENUM.V2) {
        // V2 requires merkleRoot
        const emptyMerkleRoot = ethers.ZeroHash; // Use zero hash for public phase

        unsignedTx = await contract.addPhase.populateTransaction(
          phaseType,
          ethers.parseEther(price),
          startTime,
          endTime,
          maxSupply,
          maxPerWallet,
          emptyMerkleRoot
        );
      } else {
        // V3 doesn't require merkleRoot
        unsignedTx = await contract.addPhase.populateTransaction(
          phaseType,
          ethers.parseEther(price),
          startTime,
          endTime,
          maxSupply,
          maxPerWallet
        );
      }

      return this.prepareUnsignedTransaction(unsignedTx, from);
    } catch (error) {
      throw new CustomError(
        `Failed to create add phase transaction: ${error}`,
        500
      );
    }
  }

  async getUnsignedUpdatePhaseTransaction(
    collectionAddress: string,
    phaseIndex: number,
    phaseType: number,
    price: string,
    startTime: number,
    endTime: number,
    maxSupply: number,
    maxPerWallet: number,
    // merkleRoot: string,
    from: string
  ): Promise<ethers.TransactionRequest> {
    // Ensure all numeric values are properly converted
    // const phaseIndexNum = Number(phaseIndex);
    // const phaseTypeNum = Number(phaseType);
    // const priceWei = ethers.parseEther(String(price));
    // const startTimeNum = BigInt(String(startTime));
    // const endTimeNum = BigInt(String(endTime));
    // const maxSupplyNum = Number(maxSupply);
    // const maxPerWalletNum = Number(maxPerWallet);
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        this.versionConfig.directMintNftAbi,
        this.provider
      );
      let unsignedTx;

      if (this.contractVersion === CONTRACT_VERSIONS_ENUM.V2) {
        // V2 requires merkleRoot
        const emptyMerkleRoot = ethers.ZeroHash; // Use zero hash for public phase

        unsignedTx = await contract.updatePhase.populateTransaction(
          phaseIndex,
          phaseType,
          ethers.parseEther(price),
          startTime,
          endTime,
          maxSupply,
          maxPerWallet,
          emptyMerkleRoot
        );
      } else {
        // V3 doesn't require merkleRoot
        unsignedTx = await contract.updatePhase.populateTransaction(
          phaseIndex,
          phaseType,
          ethers.parseEther(price),
          startTime,
          endTime,
          maxSupply,
          maxPerWallet
        );
      }
      return this.prepareUnsignedTransaction(unsignedTx, from);
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(
        `Failed to create update phase transaction: ${error}`,
        500
      );
    }
  }

  // DG Todo Update the caching layer seperate
  async getActivePhase(collectionAddress: string) {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        this.versionConfig.directMintNftAbi,
        this.provider
      );

      const now = BigInt(Math.floor(Date.now() / 1000));

      const cachedPhase = await redis.get(`phase:${collectionAddress}`);
      if (cachedPhase) {
        const [phaseIndexStr, cachePhase] = JSON.parse(cachedPhase);
        const phaseIndex = BigInt(phaseIndexStr);
        const phase = {
          phaseType: BigInt(cachePhase.phaseType),
          price: BigInt(cachePhase.price),
          startTime: BigInt(cachePhase.startTime),
          endTime: BigInt(cachePhase.endTime),
          maxSupply: BigInt(cachePhase.maxSupply),
          maxPerWallet: BigInt(cachePhase.maxPerWallet),
          mintedInPhase: BigInt(cachePhase.mintedInPhase)
        };

        if (now < phase.startTime || now > phase.endTime) {
          logger.info(`Stale cachedPhase found: ${collectionAddress}`);
          await redis.del(`phase:${collectionAddress}`);
        } else {
          return {
            isActive: true,
            phaseIndex,
            phaseType: phase.phaseType,
            price: phase.price,
            startTime: phase.startTime,
            endTime: phase.endTime,
            maxSupply: phase.maxSupply,
            maxPerWallet: phase.maxPerWallet,
            mintedInPhase: phase.mintedInPhase
          };
        }
      }

      const [phaseIndex, phase] = await contract.getActivePhase();

      const cachePhase = {
        phaseType: phase.phaseType.toString(),
        price: phase.price.toString(),
        startTime: phase.startTime.toString(),
        endTime: phase.endTime.toString(),
        maxSupply: phase.maxSupply.toString(),
        maxPerWallet: phase.maxPerWallet.toString(),
        mintedInPhase: phase.mintedInPhase.toString()
      };
      logger.info(`Cache miss: ${cachePhase}`);
      await redis.set(
        `phase:${collectionAddress}`,
        JSON.stringify([phaseIndex.toString(), cachePhase]),
        "EX",
        30
      );

      return {
        isActive: true,
        phaseIndex,
        phaseType: phase.phaseType,
        price: phase.price,
        startTime: phase.startTime,
        endTime: phase.endTime,
        maxSupply: phase.maxSupply,
        maxPerWallet: phase.maxPerWallet,
        mintedInPhase: phase.mintedInPhase
      };
    } catch (error) {
      throw new CustomError(`Failed to get active phase: ${error}`, 500);
    }
  }

  async getPhaseCount(collectionAddress: string): Promise<bigint> {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        this.versionConfig.directMintNftAbi,
        this.provider
      );

      const count = await contract.getPhaseCount();
      return count;
    } catch (error) {
      throw new CustomError(`Failed to get phase count: ${error}`, 500);
    }
  }

  async getMintedInPhase(
    collectionAddress: string,
    user: string,
    phaseType: number
  ): Promise<bigint> {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        this.versionConfig.directMintNftAbi,
        this.provider
      );

      return await contract.getMintedInPhase(user, phaseType);
    } catch (error) {
      throw new CustomError(`Failed to get minted in phase: ${error}`, 500);
    }
  }

  // Cached method to get network information
  async getNetwork(): Promise<{ chainId: bigint }> {
    if (!this.networkCache) {
      const network = await this.provider.getNetwork();
      this.networkCache = network;
    }
    return this.networkCache;
  }
  /**
   * Gets all phases from the NFT contract
   * @param collectionAddress The address of the NFT contract
   * @returns An array of all phases with their details
   */
  async getAllPhases(collectionAddress: string) {
    try {
      // Validate collection address
      if (!ethers.isAddress(collectionAddress)) {
        throw new CustomError("Invalid collection address", 400);
      }

      const contract = new ethers.Contract(
        collectionAddress,
        this.versionConfig.directMintNftAbi,
        this.provider
      );

      // Get the total number of phases
      const phaseCount = await contract.getPhaseCount();

      // Create an array to store all phases
      const phases = [];

      // Retrieve each phase one by one
      for (let i = 0; i < Number(phaseCount); i++) {
        try {
          // Get the raw phase data
          const phase = await contract.phases(i);

          // Create a base phase object with common properties
          const phaseData: any = {
            phaseIndex: i,
            phaseType: Number(phase.phaseType),
            price: ethers.formatEther(phase.price),
            priceWei: phase.price.toString(), // Convert BigInt to string
            startTime: Number(phase.startTime),
            endTime: Number(phase.endTime),
            maxSupply: Number(phase.maxSupply),
            maxPerWallet: Number(phase.maxPerWallet),
            mintedInPhase: Number(phase.mintedInPhase)
          };

          // Add human-readable dates
          phaseData.startDate = new Date(
            Number(phase.startTime) * 1000
          ).toISOString();
          phaseData.endDate =
            phase.endTime > 0
              ? new Date(Number(phase.endTime) * 1000).toISOString()
              : "No end date (indefinite)";

          // Get phase type name based on contract version
          if (this.contractVersion === "2.0") {
            // V2 has NOT_STARTED(0), WHITELIST(1), PUBLIC(2)
            const phaseTypeNames = ["NOT_STARTED", "WHITELIST", "PUBLIC"];
            phaseData.phaseTypeName =
              phaseTypeNames[phaseData.phaseType] || "UNKNOWN";

            // Add merkleRoot for V2 if it exists
            if ("merkleRoot" in phase) {
              phaseData.merkleRoot = phase.merkleRoot;
            }
          } else {
            // V3 has WHITELIST(0), FCFS(1), PUBLIC(2)
            const phaseTypeNames = ["WHITELIST", "FCFS", "PUBLIC"];
            phaseData.phaseTypeName =
              phaseTypeNames[phaseData.phaseType] || "UNKNOWN";
          }

          // Check if the phase is active
          const currentTime = Math.floor(Date.now() / 1000);
          phaseData.isActive =
            currentTime >= phaseData.startTime &&
            (phaseData.endTime === 0 || currentTime <= phaseData.endTime);

          phases.push(phaseData);
        } catch (error) {
          console.error(`Error retrieving phase ${i}:`, error);
          // Add an error placeholder instead of failing the whole request
          phases.push({
            phaseIndex: i,
            error: "Failed to retrieve phase data",
            errorDetails: error
          });
        }
      }

      return {
        totalPhases: Number(phaseCount),
        phases: phases
      };
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(`Failed to get all phases: ${error}`, 500);
    }
  }

  getContractVersion(): string {
    return this.contractVersion;
  }

  // Get a list of supported contract versions
  static getSupportedVersions(): string[] {
    return Object.keys(CONTRACT_VERSIONS);
  }
}
