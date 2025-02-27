import { ethers } from "ethers";
import { PinataSDK } from "pinata-web3";
import { CustomError } from "../../../../exceptions/CustomError";
import { EVM_CONFIG } from "../../evm-config";
import { config } from "../../../../config/config";
import { BaseNFTService } from "./baseNFTService";

export class DirectMintNFTService extends BaseNFTService {
  private readonly DOMAIN_NAME = "UnifiedNFT";
  private readonly DOMAIN_VERSION = "1";
  private readonly MAX_ROYALTY_FEE = 1000; // 10%
  private readonly MAX_PLATFORM_FEE = 1000; // 10%
  private readonly MIN_CONTRACT_NAME_LENGTH = 1;
  private readonly MAX_CONTRACT_NAME_LENGTH = 50;
  private readonly MIN_SYMBOL_LENGTH = 1;
  private readonly MAX_SYMBOL_LENGTH = 10;
  private readonly SIGNATURE_EXPIRY = 3600; // 1 hour in seconds

  async validateUpdatePhaseParams(
    collectionAddress: string,
    phaseIndex: number,
    phaseType: number,
    price: bigint,
    startTime: number,
    endTime: number,
    maxSupply: number,
    maxPerWallet: number,
    merkleRoot: string,
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
    if (phaseType < 0 || phaseType > 2) {
      // NOT_STARTED=0, WHITELIST=1, PUBLIC=2
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

    // Validate merkle root for whitelist phase
    if (
      phaseType === 1 &&
      (!merkleRoot ||
        merkleRoot ===
          "0x0000000000000000000000000000000000000000000000000000000000000000")
    ) {
      throw new CustomError("Merkle root required for whitelist phase", 400);
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
        `Royalty fee must be between 0 and ${this.MAX_ROYALTY_FEE} (${this.MAX_ROYALTY_FEE / 100}%)`,
        400
      );
    }

    if (platformFee < 0 || platformFee > this.MAX_PLATFORM_FEE) {
      throw new CustomError(
        `Platform fee must be between 0 and ${this.MAX_PLATFORM_FEE} (${this.MAX_PLATFORM_FEE / 100}%)`,
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
        EVM_CONFIG.DIRECT_MINT_NFT_ABI,
        EVM_CONFIG.DIRECT_MINT_NFT_BYTECODE,
        this.provider
      );

      const unsignedTx = await factory.getDeployTransaction(
        initialOwner,
        contractName,
        symbol,
        royaltyFee,
        platformFee,
        config.VAULT_ADDRESS,
        config.VAULT_ADDRESS
      );
      return this.prepareUnsignedTransaction(unsignedTx, initialOwner);
    } catch (error) {
      console.log(error);
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
    const { chainId } = await this.provider.getNetwork();
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

    const timestamp =
      Math.floor(Date.now() / 1000) - EVM_CONFIG.DEFAULT_SIGN_DEADLINE;

    const types = {
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

    const value = {
      minter: minterAddress,
      tokenId: tokenId,
      uri: uri,
      price: ethers.parseEther(price),
      phaseIndex: phaseIndex,
      uniqueId: uniqueId,
      timestamp: timestamp
    };
    const backendWallet = new ethers.Wallet(backendPrivateKey, this.provider);
    const signature = await backendWallet.signTypedData(domain, types, value);

    return { signature, uniqueId, timestamp };
  }
  async getUnsignedMintTransaction(
    collectionAddress: string,
    tokenId: string,
    uri: string,
    price: string,
    uniqueId: string,
    timestamp: number,
    signature: string,
    merkleProof: string[],
    from: string
  ): Promise<ethers.TransactionRequest> {
    console.log(
      "params",
      collectionAddress,
      tokenId,
      uri,
      price,
      uniqueId,
      timestamp,
      signature,
      merkleProof,
      from
    );
    // await this.validateMintTransaction(
    //   collectionAddress,
    //   tokenId,
    //   uri,
    //   price,
    //   uniqueId,
    //   timestamp,
    //   signature,
    //   merkleProof,
    //   from
    // );

    const phaseInfo = await this.getActivePhase(collectionAddress);

    try {
      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.DIRECT_MINT_NFT_ABI,
        this.provider
      );

      // await this.validateTokenBeforeMint(contract, tokenId, collectionAddress);

      // await this.verifyPhaseSupply(collectionAddress);

      // Check if the signature is valid for the given parameters
      try {
        const { chainId } = await this.provider.getNetwork();
        await this.verifySignature(collectionAddress, signature, chainId, {
          minter: from,
          tokenId,
          uri,
          price,
          phaseIndex: phaseInfo.phaseIndex, // Get actual phase index from contract
          uniqueId,
          timestamp
        });
      } catch (error) {
        throw new CustomError(`Invalid signature: ${error}`, 400);
      }

      const unsignedTx = await contract.mint.populateTransaction(
        tokenId,
        uri,
        uniqueId,
        timestamp,
        signature,
        merkleProof,
        { value: ethers.parseEther(price) }
      );

      return this.prepareUnsignedTransaction(unsignedTx, from);
    } catch (error) {
      throw new CustomError(`Failed to create mint transaction: ${error}`, 500);
    }
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
      timestamp: number;
    }
  ) {
    const types = {
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

    const domain = {
      name: this.DOMAIN_NAME,
      version: this.DOMAIN_VERSION,
      chainId: Number(chainId),
      verifyingContract: collectionAddress
    };

    const value = {
      minter: params.minter,
      tokenId: params.tokenId,
      uri: params.uri,
      price: ethers.parseEther(params.price),
      phaseIndex: params.phaseIndex,
      uniqueId: params.uniqueId,
      timestamp: params.timestamp
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

  // Phase Management Methods - Unchanged
  async getActivePhase(collectionAddress: string) {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.DIRECT_MINT_NFT_ABI,
        this.provider
      );

      // // First check if any phase is active
      // const isActive = await contract.isActivePhasePresent();

      // if (!isActive) {
      //   // Handle case where no phase is active
      //   return {
      //     isActive: false,
      //     message: "No active phase at the current time"
      //   };
      // }

      const [phaseIndex, phase] = await contract.getActivePhase();
      return {
        isActive: true,
        phaseIndex,
        phaseType: phase.phaseType,
        price: phase.price,
        startTime: phase.startTime,
        endTime: phase.endTime,
        maxSupply: phase.maxSupply,
        maxPerWallet: phase.maxPerWallet,
        mintedInPhase: phase.mintedInPhase,
        merkleRoot: phase.merkleRoot
      };
    } catch (error) {
      throw new CustomError(`Failed to get active phase: ${error}`, 500);
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
    merkleRoot: string,
    from: string
  ): Promise<ethers.TransactionRequest> {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.DIRECT_MINT_NFT_ABI,
        this.provider
      );

      const unsignedTx = await contract.addPhase.populateTransaction(
        phaseType,
        ethers.parseEther(price),
        startTime,
        endTime,
        maxSupply,
        maxPerWallet,
        merkleRoot
      );

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
    merkleRoot: string,
    from: string
  ): Promise<ethers.TransactionRequest> {
    try {
      // Validate parameters
      await this.validateUpdatePhaseParams(
        collectionAddress,
        phaseIndex,
        phaseType,
        ethers.parseEther(price),
        startTime,
        endTime,
        maxSupply,
        maxPerWallet,
        merkleRoot,
        from
      );

      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.DIRECT_MINT_NFT_ABI,
        this.provider
      );

      const unsignedTx = await contract.updatePhase.populateTransaction(
        phaseIndex,
        phaseType,
        ethers.parseEther(price),
        startTime,
        endTime,
        maxSupply,
        maxPerWallet,
        merkleRoot
      );

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

  // Additional helper methods (removed getNonce since it's no longer needed)
  async getMintedInPhase(
    collectionAddress: string,
    user: string,
    phaseType: number
  ): Promise<number> {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.DIRECT_MINT_NFT_ABI,
        this.provider
      );

      return await contract.getMintedInPhase(user, phaseType);
    } catch (error) {
      throw new CustomError(`Failed to get minted in phase: ${error}`, 500);
    }
  }

  async getPhaseCount(collectionAddress: string): Promise<bigint> {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.DIRECT_MINT_NFT_ABI,
        this.provider
      );

      const count = await contract.getPhaseCount();
      return count;
    } catch (error) {
      throw new CustomError(`Failed to get phase count: ${error}`, 500);
    }
  }
}
