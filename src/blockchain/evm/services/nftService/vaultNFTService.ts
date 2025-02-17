import { ethers } from "ethers";
import { BaseNFTService } from "./baseNFTService";
import { config } from "../../../../config/config";
import { EVM_CONFIG } from "../../evm-config";
import { CustomError } from "../../../../exceptions/CustomError";

export class VaultMintNFTService extends BaseNFTService {
  private vaultWallet: ethers.Wallet;

  constructor(providerUrl: string) {
    super(providerUrl);
    this.vaultWallet = new ethers.Wallet(
      config.VAULT_PRIVATE_KEY,
      this.provider
    );
  }

  async getUnsignedDeploymentTransaction(
    initialOwner: string,
    minterAddress: string,
    contractName: string,
    symbol: string,
    royaltyFee: number,
    platformFee: number,
    platformFeeRecipient: string
  ) {
    // const signer = await this.provider.getSigner();
    const factory = new ethers.ContractFactory(
      EVM_CONFIG.NFT_CONTRACT_ABI,
      EVM_CONFIG.NFT_CONTRACT_BYTECODE,
      this.provider
    );

    const unsignedTx = await factory.getDeployTransaction(
      initialOwner,
      contractName,
      symbol,
      minterAddress,
      royaltyFee,
      platformFee,
      platformFeeRecipient
    );
    return this.prepareUnsignedTransaction(unsignedTx, initialOwner);
  }

  async estimateMintGasFee(
    collectionAddress: string,
    recipientAddress: string,
    nftId: string,
    uri: string,
    mintPrice: number
  ) {
    try {
      const minterWallet = new ethers.Wallet(
        config.VAULT_PRIVATE_KEY,
        this.provider
      );

      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.NFT_CONTRACT_ABI,
        minterWallet
      );

      // Create an unsigned transaction to estimate gas
      const priceInWei = ethers.parseEther(mintPrice.toString());
      const unsignedTx = await contract.mint.populateTransaction(
        recipientAddress,
        nftId,
        "",
        uri,
        priceInWei,
        {
          value: priceInWei
        }
      );

      // Estimate gas
      const gasLimit = await this.provider.estimateGas({
        ...unsignedTx,
        from: minterWallet.address
      });

      // Get current gas price
      const feeData = await this.provider.getFeeData();
      const baseFee = feeData.gasPrice || ethers.parseUnits("5", "gwei");
      const maxPriorityFeePerGas = ethers.parseUnits("0.1", "gwei");
      const maxFeePerGas = baseFee + maxPriorityFeePerGas;

      // Calculate total gas cost
      const estimatedGasCost = gasLimit * maxFeePerGas;

      return {
        estimatedGasCost,
        gasLimit,
        maxFeePerGas,
        maxPriorityFeePerGas
      };
    } catch (error) {
      throw new CustomError(`Failed to estimate mint gas fee: ${error}`, 500);
    }
  }

  async getInscriptionId(
    collectionAddress: string,
    tokenId: number
  ): Promise<string> {
    const contract = new ethers.Contract(
      collectionAddress,
      EVM_CONFIG.NFT_CONTRACT_ABI,
      this.provider
    );

    return await contract.getInscriptionId(tokenId);
  }

  async mintWithInscriptionId(
    collectionAddress: string,
    recipient: string,
    inscriptionId: string,
    nftId: string,
    mintPrice: number
  ): Promise<string> {
    // const formattedPrice = ethers.formatEther(mintPrice);
    try {
      const minterWallet = new ethers.Wallet(
        config.VAULT_PRIVATE_KEY,
        this.provider
      );

      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.NFT_CONTRACT_ABI,
        minterWallet
      );

      const contractMinterAddress = await contract.minterAddress();

      if (
        contractMinterAddress.toLowerCase() !==
        minterWallet.address.toLowerCase()
      ) {
        throw new CustomError(
          `Wallet address (${minterWallet.address}) does not match contract's minter address (${contractMinterAddress})`,
          400
        );
      }

      const priceInWei = ethers.parseEther(mintPrice.toString());

      const tx = await contract.mint(
        recipient,
        nftId,
        inscriptionId,
        "",
        priceInWei,
        {
          value: priceInWei
        }
      );
      const receipt = await tx.wait();

      if (!receipt || receipt.status === 0) {
        throw new CustomError("Transaction failed during execution", 500);
      }

      return receipt.hash;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(
        `Failed to mint NFT with inscription ID: ${error}`,
        500
      );
    }
  }
  async mintIpfsNFTUsingVault(
    collectionAddress: string,
    recipient: string,
    nftId: string,
    uri: string,
    mintPrice: number
  ): Promise<string> {
    try {
      const minterWallet = new ethers.Wallet(
        config.VAULT_PRIVATE_KEY,
        this.provider
      );

      const contract = new ethers.Contract(
        collectionAddress,
        EVM_CONFIG.NFT_CONTRACT_ABI,
        minterWallet
      );

      const contractMinterAddress = await contract.minterAddress();

      if (
        contractMinterAddress.toLowerCase() !==
        minterWallet.address.toLowerCase()
      ) {
        throw new CustomError(
          `Wallet address (${minterWallet.address}) does not match contract's minter address (${contractMinterAddress})`,
          400
        );
      }

      const priceInWei = ethers.parseEther(mintPrice.toString());

      const tx = await contract.mint(recipient, nftId, "", uri, priceInWei, {
        value: priceInWei
      });
      const receipt = await tx.wait();

      if (!receipt || receipt.status === 0) {
        throw new CustomError("Transaction failed during execution", 500);
      }

      return receipt.hash;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(`Failed to mint IPFS NFT: ${error}`, 500);
    }
  }
}
