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
    console.log(
      initialOwner,
      contractName,
      symbol,
      royaltyFee,
      platformFee,
      "params"
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
  }

  async generateMintSignature(
    collectionAddress: string,
    minter: string,
    tokenId: string,
    uri: string,
    price: string,
    deadline: number,
    chainId: string,
    backendPrivateKey: string
  ): Promise<string> {
    try {
      const domain = {
        name: this.DOMAIN_NAME,
        version: this.DOMAIN_VERSION,
        chainId: Number(chainId),
        verifyingContract: collectionAddress
      };

      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.DIRECT_MINT_NFT_ABI,
        this.provider
      );

      const nonce = await contract.getNonce(minter);

      const types = {
        MintRequest: [
          { name: "minter", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "uri", type: "string" },
          { name: "price", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      };
      console.log("Signature Generation Parameters:", {
        minter,
        tokenId,
        uri,
        price: ethers.parseEther(price).toString(),
        nonce,
        deadline
      });

      const value = {
        minter: minter,
        tokenId: tokenId,
        uri: uri,
        price: ethers.parseEther(price),
        nonce: nonce,
        deadline: deadline
      };

      const backendWallet = new ethers.Wallet(backendPrivateKey, this.provider);
      const signature = await backendWallet.signTypedData(domain, types, value);
      console.log("Generated Signature:", signature);

      return signature;
    } catch (error) {
      throw new CustomError(`Failed to generate signature: ${error}`, 500);
    }
  }

  async getUnsignedMintTransaction(
    collectionAddress: string,
    tokenId: string,
    uri: string,
    price: string,
    deadline: number,
    signature: string,
    from: string
  ): Promise<ethers.TransactionRequest> {
    try {
      console.log("Mint Request Parameters:");
      console.log("Minter:", from);
      console.log("TokenId:", tokenId);
      console.log("Price:", price);
      console.log("Deadline:", deadline);
      console.log("collectionAddress", collectionAddress);

      const { chainId } = await this.provider.getNetwork();

      await this.verifySignature(
        collectionAddress,
        signature,
        BigInt(chainId),
        {
          minter: from,
          tokenId,
          uri,
          price: price.toString(),
          deadline
        }
      );
      // console.log("Nonce:", nonces[msg.sender]);

      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.DIRECT_MINT_NFT_ABI,
        this.provider
      );

      const unsignedTx = await contract.mint.populateTransaction(
        tokenId,
        uri,
        deadline,
        signature,
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
      deadline: number;
    }
  ) {
    const contract = new ethers.Contract(
      collectionAddress,
      EVM_CONFIG.DIRECT_MINT_NFT_ABI,
      this.provider
    );

    // Get domain separator from contract
    const domainSeparator = await contract.getDomainSeparator();
    console.log("Contract Domain Separator:", domainSeparator);

    // Get nonce from contract
    const nonce = await contract.getNonce(params.minter);
    console.log("Contract Nonce:", nonce);

    // Reconstruct message
    const reconstructedMessage = {
      minter: params.minter,
      tokenId: params.tokenId,
      uri: params.uri,
      price: ethers.parseEther(params.price),
      nonce,
      deadline: params.deadline
    };
    console.log("Reconstructed Message:", reconstructedMessage);
    const types = {
      MintRequest: [
        { name: "minter", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "uri", type: "string" },
        { name: "price", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    };

    const domain = {
      name: this.DOMAIN_NAME,
      version: this.DOMAIN_VERSION,
      chainId: Number(chainId),
      verifyingContract: collectionAddress
    };

    // Verify locally
    const recoveredAddress = ethers.verifyTypedData(
      domain,
      types,
      reconstructedMessage,
      signature
    );
    console.log("Locally Recovered Address:", recoveredAddress);
    console.log("Expected Signer:", config.VAULT_ADDRESS);
  }

  // Phase Management Methods
  async getPhaseInfo(collectionAddress: string, chainId: string) {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.DIRECT_MINT_NFT_ABI,
        this.provider
      );

      const currentPhase = await contract.currentPhase();
      return {
        phaseType: currentPhase.phaseType,
        price: currentPhase.price,
        startTime: currentPhase.startTime,
        endTime: currentPhase.endTime,
        maxSupply: currentPhase.maxSupply,
        maxPerWallet: currentPhase.maxPerWallet,
        merkleRoot: currentPhase.merkleRoot
      };
    } catch (error) {
      throw new CustomError(`Failed to get phase info: ${error}`, 500);
    }
  }

  async getUnsignedSetPhaseTransaction(
    collectionAddress: string,
    phaseType: bigint,
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

      const unsignedTx = await contract.setPhase.populateTransaction(
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
        `Failed to create set phase transaction: ${error}`,
        500
      );
    }
  }

  // Fee Management Methods
  async getUnsignedSetRoyaltyTransaction(
    collectionAddress: string,
    feePercentage: number,
    from: string,
    chainId: string
  ): Promise<ethers.TransactionRequest> {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.DIRECT_MINT_NFT_ABI,
        this.provider
      );

      const unsignedTx =
        await contract.setRoyaltyInfo.populateTransaction(feePercentage);

      return this.prepareUnsignedTransaction(unsignedTx, from);
    } catch (error) {
      throw new CustomError(
        `Failed to create set royalty transaction: ${error}`,
        500
      );
    }
  }

  async getUnsignedSetPlatformFeeTransaction(
    collectionAddress: string,

    feePercentage: number,
    feeRecipient: string,
    from: string,
    chainId: string
  ): Promise<ethers.TransactionRequest> {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.DIRECT_MINT_NFT_ABI,
        this.provider
      );

      const unsignedTx = await contract.setPlatformFee.populateTransaction(
        feePercentage,
        feeRecipient
      );

      return this.prepareUnsignedTransaction(unsignedTx, from);
    } catch (error) {
      throw new CustomError(
        `Failed to create set platform fee transaction: ${error}`,
        500
      );
    }
  }
}
