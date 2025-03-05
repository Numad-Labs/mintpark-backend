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

  async getUnsignedDeploymentTransaction(
    initialOwner: string,
    contractName: string,
    symbol: string,
    royaltyFee: number,
    platformFee: number
  ) {
    try {
      // await this.validateDeploymentParams(
      //   initialOwner,
      //   contractName,
      //   symbol,
      //   royaltyFee,
      //   platformFee
      // );

      // Use NFTFactory contract instead of directly deploying
      const factoryContract = new ethers.Contract(
        EVM_CONFIG.NFT_FACTORY_ADDRESS,
        EVM_CONFIG.NFT_FACTORY_ABI,
        this.provider
      );

      const backendSigner = config.VAULT_ADDRESS;
      const platformFeeRecipient = config.VAULT_ADDRESS;

      const unsignedTx = await factoryContract.deployNFT.populateTransaction(
        contractName,
        symbol,
        royaltyFee,
        platformFee,
        platformFeeRecipient,
        backendSigner
      );

      return this.prepareUnsignedTransaction(unsignedTx, initialOwner);
    } catch (error) {
      console.log(error);
      throw new CustomError(
        `Failed to create deployment transaction: ${error}`,
        500
      );
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
      name: this.DOMAIN_NAME,
      version: this.DOMAIN_VERSION,
      chainId: Number(chainId),
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
        EVM_CONFIG.LAUNCH_NFT_V3_ABI, // Updated to use LaunchNFTV3 ABI
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
          phaseIndex: phaseInfo.phaseIndex,
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

  // Phase Management Methods - Updated to use PhaseManager through the main contract
  async getActivePhase(collectionAddress: string) {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.LAUNCH_NFT_V3_ABI, // Updated to use LaunchNFTV3 ABI
        this.provider
      );

      // Get PhaseManager address from main contract
      const phaseManagerAddress = await contract.phaseManager();

      // Create contract instance for PhaseManager
      const phaseManagerContract = new ethers.Contract(
        phaseManagerAddress,
        EVM_CONFIG.PHASE_MANAGER_ABI,
        this.provider
      );

      // Get active phase from PhaseManager via main contract
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

  // Updated to interact with PhaseManager contract
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
        EVM_CONFIG.LAUNCH_NFT_V3_ABI,
        this.provider
      );

      // Get PhaseManager address
      const phaseManagerAddress = await contract.phaseManager();

      // Create PhaseManager contract instance
      const phaseManagerContract = new ethers.Contract(
        phaseManagerAddress,
        EVM_CONFIG.PHASE_MANAGER_ABI,
        this.provider
      );

      const unsignedTx =
        await phaseManagerContract.addPhase.populateTransaction(
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
      // // Validate parameters
      // await this.validateUpdatePhaseParams(
      //   collectionAddress,
      //   phaseIndex,
      //   phaseType,
      //   ethers.parseEther(price),
      //   startTime,
      //   endTime,
      //   maxSupply,
      //   maxPerWallet,
      //   merkleRoot,
      //   from
      // );

      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.LAUNCH_NFT_V3_ABI,
        this.provider
      );

      // Get PhaseManager address
      const phaseManagerAddress = await contract.phaseManager();

      // Create PhaseManager contract instance
      const phaseManagerContract = new ethers.Contract(
        phaseManagerAddress,
        EVM_CONFIG.PHASE_MANAGER_ABI,
        this.provider
      );

      const unsignedTx =
        await phaseManagerContract.updatePhase.populateTransaction(
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

  // Updated to interact with PhaseManager contract
  async getMintedInPhase(
    collectionAddress: string,
    user: string,
    phaseType: number
  ): Promise<number> {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.LAUNCH_NFT_V3_ABI,
        this.provider
      );

      // Get PhaseManager address
      const phaseManagerAddress = await contract.phaseManager();

      // Create PhaseManager contract instance
      const phaseManagerContract = new ethers.Contract(
        phaseManagerAddress,
        EVM_CONFIG.PHASE_MANAGER_ABI,
        this.provider
      );

      return await phaseManagerContract.getMintedInPhase(user, phaseType);
    } catch (error) {
      throw new CustomError(`Failed to get minted in phase: ${error}`, 500);
    }
  }

  async getPhaseCount(collectionAddress: string): Promise<bigint> {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.LAUNCH_NFT_V3_ABI,
        this.provider
      );

      // Get PhaseManager address
      const phaseManagerAddress = await contract.phaseManager();

      // Create PhaseManager contract instance
      const phaseManagerContract = new ethers.Contract(
        phaseManagerAddress,
        EVM_CONFIG.PHASE_MANAGER_ABI,
        this.provider
      );

      const count = await phaseManagerContract.getPhaseCount();
      return count;
    } catch (error) {
      throw new CustomError(`Failed to get phase count: ${error}`, 500);
    }
  }

  // New method to handle the pause functionality
  async getUnsignedSetPausedTransaction(
    collectionAddress: string,
    isPaused: boolean,
    from: string
  ): Promise<ethers.TransactionRequest> {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.LAUNCH_NFT_V3_ABI,
        this.provider
      );

      const unsignedTx = await contract.setPaused.populateTransaction(isPaused);

      return this.prepareUnsignedTransaction(unsignedTx, from);
    } catch (error) {
      throw new CustomError(
        `Failed to create set paused transaction: ${error}`,
        500
      );
    }
  }

  // Method to check if contract is paused
  async isContractPaused(collectionAddress: string): Promise<boolean> {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.LAUNCH_NFT_V3_ABI,
        this.provider
      );

      return await contract.isPaused();
    } catch (error) {
      throw new CustomError(
        `Failed to check if contract is paused: ${error}`,
        500
      );
    }
  }
}
