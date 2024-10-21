// src/services/nftService.ts
import { ethers } from "ethers";
import { ThirdwebStorage } from "@thirdweb-dev/storage";
import * as fs from "fs";
import * as path from "path";
// import { NFT_FACTORY_ABI, NFT_FACTORY_ADDRESS } from "../config";
import { EVM_CONFIG } from "../evm-config";

const provider = new ethers.JsonRpcProvider(EVM_CONFIG.RPC_URL);
const storage = new ThirdwebStorage({
  secretKey: process.env.THIRDWEB_SECRET!,
});

export class NftService {
  static async createNFTContractDeploymentTransaction(
    name: string,
    symbol: string,
    baseURI: string
  ) {
    const nftFactory = new ethers.Contract(
      EVM_CONFIG.NFT_CONTRACT_BYTECODE,
      EVM_CONFIG.NFT_CONTRACT_ABI,
      provider
    );
    return await nftFactory.populateTransaction.deployNFTContract(
      name,
      symbol,
      baseURI
    );
  }

  static async createMintNFTTransaction(
    contractAddress: string,
    recipientAddress: string,
    tokenId: number,
    name: string,
    description: string,
    imagePath: string
  ) {
    const nftContract = new ethers.Contract(
      contractAddress,
      EVM_CONFIG.NFT_CONTRACT_ABI,
      provider
    );

    const ipfsImageUri = await this.uploadToIPFS(imagePath);
    const metadata = {
      name: name,
      description: description,
      image: ipfsImageUri,
    };
    const metadataUri = await storage.upload(metadata);

    return await nftContract.populateTransaction.safeMint(
      recipientAddress,
      tokenId,
      metadataUri
    );
  }

  private static async uploadMetadata(
    name: string,
    description: string,
    image: Express.Multer.File
  ) {
    const storage = new ThirdwebStorage();
    const imageUri = await storage.upload(image.buffer);

    const metadata = {
      name,
      description,
      image: imageUri,
    };

    return await storage.upload(metadata);
  }
}
