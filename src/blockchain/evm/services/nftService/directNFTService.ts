import { ethers } from "ethers";
import { PinataSDK } from "pinata-web3";
import { CustomError } from "../../../../exceptions/CustomError";
import { EVM_CONFIG } from "../../evm-config";
import { config } from "../../../../config/config";
import { BaseNFTService } from "./baseNFTService";

export class DirectMintNFTService extends BaseNFTService {
  private readonly DOMAIN_NAME = "UnifiedNFT";
  private readonly DOMAIN_VERSION = "1";

  async getUnsignedDeploymentTransaction(
    initialOwner: string,
    contractName: string,
    symbol: string,
    royaltyFee: number,
    platformFee: number
  ) {
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

  // async generateMintSignature(
  //   collectionAddress: string,
  //   minter: string,
  //   tokenId: string,
  //   uri: string,
  //   price: string,
  //   phaseIndex: number,
  //   backendPrivateKey: string
  // ): Promise<{ signature: string; uniqueId: string; timestamp: number }> {
  //   try {
  //     const { chainId } = await this.provider.getNetwork();

  //     const domain = {
  //       name: this.DOMAIN_NAME,
  //       version: this.DOMAIN_VERSION,
  //       chainId: chainId,
  //       verifyingContract: collectionAddress
  //     };

  //     // Generate unique identifier
  //     const uniqueId = ethers.keccak256(
  //       ethers.solidityPacked(
  //         ["address", "uint256", "string", "uint256"],
  //         [minter, tokenId, uri, Date.now()]
  //       )
  //     );

  //     const timestamp = Math.floor(Date.now() / 1000);

  //     const types = {
  //       MintRequest: [
  //         { name: "minter", type: "address" },
  //         { name: "tokenId", type: "uint256" },
  //         { name: "uri", type: "string" },
  //         { name: "price", type: "uint256" },
  //         { name: "phaseIndex", type: "uint256" },
  //         { name: "uniqueId", type: "bytes32" },
  //         { name: "timestamp", type: "uint256" }
  //       ]
  //     };

  //     const value = {
  //       minter: minter,
  //       tokenId: tokenId,
  //       uri: uri,
  //       price: ethers.parseEther(price),
  //       phaseIndex: phaseIndex,
  //       uniqueId: uniqueId,
  //       timestamp: timestamp
  //     };

  //     const backendWallet = new ethers.Wallet(backendPrivateKey, this.provider);
  //     const signature = await backendWallet.signTypedData(domain, types, value);

  //     return {
  //       signature,
  //       uniqueId,
  //       timestamp
  //     };
  //   } catch (error) {
  //     throw new CustomError(`Failed to generate signature: ${error}`, 500);
  //   }
  // }

  async generateMintSignature(
    collectionAddress: string,
    minterAddress: string,
    tokenId: string,
    uri: string,
    price: string,
    phaseIndex: number
  ) {
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
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.DIRECT_MINT_NFT_ABI,
        this.provider
      );

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
