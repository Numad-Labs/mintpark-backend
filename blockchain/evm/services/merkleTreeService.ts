// services/merkleService.ts
import { MerkleTree } from "merkletreejs";
import { keccak256, ethers } from "ethers";
import { wlRepository } from "../../../src/repositories/wlRepository";
import { CustomError } from "../../../src/exceptions/CustomError";

export class MerkleService {
  private merkleTreeCache: Map<string, MerkleTree> = new Map();

  private generateMerkleTree(addresses: string[]): MerkleTree {
    const leaves = addresses.map((addr) =>
      keccak256(ethers.solidityPacked(["address"], [addr.toLowerCase()]))
    );
    return new MerkleTree(leaves, keccak256, { sortPairs: true });
  }

  async getMerkleTreeForLaunch(launchId: string): Promise<MerkleTree> {
    // Check cache first
    const cachedTree = this.merkleTreeCache.get(launchId);
    if (cachedTree) {
      return cachedTree;
    }

    // // Get addresses from database
    // const addresses = await db
    //   .selectFrom('wl_address')
    //   .select('address')
    //   .where('launch_id', '=', launchId)
    //   .execute();

    const addresses = await wlRepository.getByLaunchId(launchId);
    if (!addresses) {
      throw new CustomError(`Could not find whitelist addresses`, 400);
    }
    const merkleTree = this.generateMerkleTree(addresses.map((a) => a.address));

    // Cache the tree
    this.merkleTreeCache.set(launchId, merkleTree);

    return merkleTree;
  }

  async getMerkleProof(launchId: string, address: string): Promise<string[]> {
    const merkleTree = await this.getMerkleTreeForLaunch(launchId);

    const leaf = keccak256(
      ethers.solidityPacked(["address"], [address.toLowerCase()])
    );

    return merkleTree.getHexProof(leaf);
  }

  async isAddressWhitelisted(
    launchId: string,
    address: string
  ): Promise<boolean> {
    const merkleTree = await this.getMerkleTreeForLaunch(launchId);
    const proof = await this.getMerkleProof(launchId, address);

    const leaf = keccak256(
      ethers.solidityPacked(["address"], [address.toLowerCase()])
    );

    return merkleTree.verify(proof, leaf, merkleTree.getHexRoot());
  }

  // Invalidate cache when whitelist is updated
  invalidateCache(launchId: string) {
    this.merkleTreeCache.delete(launchId);
  }
}

export const merkleService = new MerkleService();
