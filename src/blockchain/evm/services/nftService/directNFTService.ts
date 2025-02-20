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

  async validatePhaseSupply(contract: ethers.Contract, phase: any) {
    // Get current phase stats
    const [phaseIndex, currentPhase] = await contract.getActivePhase();

    // Check if maxSupply is set (not zero) and if we've reached it
    if (currentPhase.maxSupply !== BigInt(0)) {
      const mintedInPhase = currentPhase.mintedInPhase;
      const maxSupply = currentPhase.maxSupply;

      console.log("Phase Supply Check:", {
        mintedInPhase: mintedInPhase.toString(),
        maxSupply: maxSupply.toString(),
        remaining: (maxSupply - mintedInPhase).toString()
      });

      if (mintedInPhase >= maxSupply) {
        throw new Error("Phase supply limit reached");
      }
    }

    return {
      phaseIndex,
      currentPhase,
      remainingSupply:
        currentPhase.maxSupply !== BigInt(0)
          ? currentPhase.maxSupply - currentPhase.mintedInPhase
          : "unlimited"
    };
  }

  async verifyPhaseSupply(collectionAddress: string): Promise<void> {
    const contract = new ethers.Contract(
      collectionAddress,
      EVM_CONFIG.DIRECT_MINT_NFT_ABI,
      this.provider
    );

    try {
      // Get active phase info
      const [phaseIndex, phase] = await contract.getActivePhase();

      // Log phase information for debugging
      console.log("Active Phase Info:", {
        phaseIndex: phaseIndex.toString(),
        phaseType: phase.phaseType.toString(),
        maxSupply: phase.maxSupply.toString(),
        mintedInPhase: phase.mintedInPhase.toString()
      });

      // Check phase supply
      if (
        phase.maxSupply !== BigInt(0) &&
        phase.mintedInPhase >= phase.maxSupply
      ) {
        throw new CustomError("Phase supply limit reached", 400);
      }
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw new CustomError(`Failed to verify phase supply: ${error}`, 500);
    }
  }

  async validateTokenBeforeMint(
    contract: ethers.Contract,
    tokenId: string,
    collectionAddress: string
  ) {
    try {
      // Try to get the owner of the token
      try {
        const owner = await contract.ownerOf(tokenId);
        if (owner && owner !== ethers.ZeroAddress) {
          console.log(`Token ${tokenId} already minted to ${owner}`);
          throw new Error(`Token ${tokenId} already minted`);
        }
      } catch (error) {
        // If the error is ERC721NonexistentToken, the token doesn't exist (good)
        if (
          error instanceof Error &&
          !(
            error.message.includes("nonexistent token") ||
            error.message.includes("ERC721NonexistentToken")
          )
        ) {
          throw error;
        }
      }

      // Log the attempt for debugging
      console.log(`Attempting to mint token ${tokenId}`, {
        collectionAddress,
        tokenId,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error(`Token validation failed for ${tokenId}:`, error);
      throw error;
    }
  }

  private async verifyPhaseAndTokenStatus(
    contract: ethers.Contract,
    tokenId: string,
    from: string
  ) {
    try {
      // Check if token already exists
      try {
        const owner = await contract.ownerOf(tokenId);
        // Use proper address comparison
        if (
          owner &&
          ethers.isAddress(owner) &&
          owner.toLowerCase() !== ethers.ZeroAddress.toLowerCase()
        ) {
          throw new CustomError("Token ID already minted", 400);
        }
      } catch (error) {
        // ERC721NonexistentToken error is expected for unminted tokens
        if (
          error instanceof Error &&
          !(
            error.message.includes("nonexistent token") ||
            error.message.includes("ERC721NonexistentToken")
          )
        ) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          throw new CustomError(
            `Token verification failed: ${errorMessage}`,
            400
          );
        }
        // Token doesn't exist - this is what we want
      }

      // Get active phase info
      const [phaseIndex, phase] = await contract.getActivePhase();

      // Check phase supply limits
      if (phase.maxSupply !== BigInt(0)) {
        if (phase.mintedInPhase >= phase.maxSupply) {
          throw new CustomError("Phase supply limit reached", 400);
        }
      }

      // Check wallet limits for non-public phases
      if (phase.phaseType !== BigInt(2)) {
        // Not PUBLIC phase
        const mintedInPhase = await contract.getMintedInPhase(
          from,
          phase.phaseType
        );
        if (
          phase.maxPerWallet !== BigInt(0) &&
          mintedInPhase >= phase.maxPerWallet
        ) {
          throw new CustomError("Wallet limit reached for this phase", 400);
        }
      }

      return { phaseIndex, phase };
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new CustomError(
        `Failed to verify phase and token status: ${errorMessage}`,
        500
      );
    }
  }

  async validateMintTransaction(
    collectionAddress: string,
    tokenId: string,
    uri: string,
    price: string,
    uniqueId: string,
    timestamp: number,
    signature: string,
    merkleProof: string[],
    from: string
  ) {
    // Basic parameter validation
    if (!from || !ethers.isAddress(from)) {
      throw new CustomError("Invalid from address", 400);
    }

    const normalizedFrom = from.toLowerCase();
    if (normalizedFrom === ethers.ZeroAddress.toLowerCase()) {
      throw new CustomError("From address cannot be zero address", 400);
    }

    if (!collectionAddress || !ethers.isAddress(collectionAddress)) {
      throw new CustomError("Invalid collection address", 400);
    }

    const normalizedCollection = collectionAddress.toLowerCase();

    // Token ID validation
    try {
      const tokenIdBigInt = BigInt(tokenId);
      if (tokenIdBigInt <= BigInt(0)) {
        throw new CustomError("Token ID must be positive", 400);
      }
    } catch {
      throw new CustomError("Invalid token ID format", 400);
    }

    // URI validation
    if (!uri || !uri.trim()) {
      throw new CustomError("URI cannot be empty", 400);
    }

    if (!uri.startsWith("ipfs://") && !uri.startsWith("https://")) {
      throw new CustomError("URI must start with ipfs:// or https://", 400);
    }

    // Price validation
    try {
      const priceInEther = ethers.parseEther(price);
      if (priceInEther < BigInt(0)) {
        throw new CustomError("Price cannot be negative", 400);
      }
    } catch {
      throw new CustomError("Invalid price format", 400);
    }

    // Timestamp validation
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (timestamp + this.SIGNATURE_EXPIRY < currentTimestamp) {
      throw new CustomError("Signature has expired", 400);
    }

    if (timestamp > currentTimestamp + 300) {
      // 5 minutes into future
      throw new CustomError("Timestamp too far in the future", 400);
    }

    // Signature validation
    if (!signature || !signature.startsWith("0x") || signature.length !== 132) {
      throw new CustomError("Invalid signature format", 400);
    }

    // Merkle proof validation
    if (merkleProof && !Array.isArray(merkleProof)) {
      throw new CustomError("Invalid merkle proof format", 400);
    }

    if (merkleProof && !merkleProof.every((proof) => proof.startsWith("0x"))) {
      throw new CustomError(
        "Invalid merkle proof format - must be hex strings",
        400
      );
    }

    // Contract validation
    const code = await this.provider.getCode(collectionAddress);
    if (code === "0x") {
      throw new CustomError("Collection contract does not exist", 400);
    }

    // Verify uniqueId format
    if (!uniqueId || !uniqueId.startsWith("0x") || uniqueId.length !== 66) {
      throw new CustomError("Invalid uniqueId format", 400);
    }

    // Create contract instance to check additional constraints
    const contract = new ethers.Contract(
      collectionAddress,
      EVM_CONFIG.DIRECT_MINT_NFT_ABI,
      this.provider
    );

    // Verify phase and token status
    await this.verifyPhaseAndTokenStatus(contract, tokenId, from);
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

  async validateMintParams(
    collectionAddress: string,
    minterAddress: string,
    tokenId: string,
    uri: string,
    price: string,
    phaseIndex: number
  ) {
    if (!ethers.isAddress(collectionAddress)) {
      throw new CustomError("Invalid collection address", 400);
    }

    if (!ethers.isAddress(minterAddress)) {
      throw new CustomError("Invalid minter address", 400);
    }

    if (minterAddress === ethers.ZeroAddress) {
      throw new CustomError("Minter address cannot be zero address", 400);
    }

    try {
      const tokenIdBigInt = BigInt(tokenId);
      if (tokenIdBigInt <= BigInt(0)) {
        throw new CustomError("Token ID must be positive", 400);
      }
    } catch {
      throw new CustomError("Invalid token ID format", 400);
    }

    if (!uri || !uri.trim()) {
      throw new CustomError("URI cannot be empty", 400);
    }

    if (!uri.startsWith("ipfs://") && !uri.startsWith("https://")) {
      throw new CustomError("URI must start with ipfs:// or https://", 400);
    }

    try {
      const priceInEther = ethers.parseEther(price);
      if (priceInEther < BigInt(0)) {
        throw new CustomError("Price cannot be negative", 400);
      }
    } catch {
      throw new CustomError("Invalid price format", 400);
    }

    if (phaseIndex < 0) {
      throw new CustomError("Phase index cannot be negative", 400);
    }

    // Validate if phase exists and is active
    const contract = new ethers.Contract(
      collectionAddress,
      EVM_CONFIG.DIRECT_MINT_NFT_ABI,
      this.provider
    );

    const phaseCount = await contract.getPhaseCount();
    if (BigInt(phaseIndex) >= phaseCount) {
      throw new CustomError("Invalid phase index", 400);
    }

    const isPhaseActive = await contract.isActivePhasePresent();
    if (!isPhaseActive) {
      throw new CustomError("No active phase present", 400);
    }
  }

  async getUnsignedDeploymentTransaction(
    initialOwner: string,
    contractName: string,
    symbol: string,
    royaltyFee: number,
    platformFee: number
  ) {
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
      config.VAULT_ADDRESS // backendSigner is same as vault address
    );
    return this.prepareUnsignedTransaction(unsignedTx, initialOwner);
  }

  async generateMintSignature(
    collectionAddress: string,
    minterAddress: string,
    tokenId: string,
    uri: string,
    price: string,
    phaseIndex: number
  ) {
    await this.validateMintParams(
      collectionAddress,
      minterAddress,
      tokenId,
      uri,
      price,
      phaseIndex
    );
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

    const timestamp = Math.floor(Date.now() / 1000);

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
    await this.validateMintTransaction(
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

    try {
      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.DIRECT_MINT_NFT_ABI,
        this.provider
      );

      await this.validateTokenBeforeMint(contract, tokenId, collectionAddress);

      await this.verifyPhaseSupply(collectionAddress);

      // Check if the signature is valid for the given parameters
      try {
        const { chainId } = await this.provider.getNetwork();
        await this.verifySignature(collectionAddress, signature, chainId, {
          minter: from,
          tokenId,
          uri,
          price,
          phaseIndex: 1, // Get actual phase index from contract
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

      const [phaseIndex, phase] = await contract.getActivePhase();
      return {
        phaseIndex,
        phaseType: phase.phaseType,
        price: phase.price,
        startTime: phase.startTime,
        endTime: phase.endTime,
        maxSupply: phase.maxSupply,
        maxPerWallet: phase.maxPerWallet,
        maxMintPerPhase: phase.maxMintPerPhase,
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
    maxMintPerPhase: number,
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
        maxMintPerPhase,
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
