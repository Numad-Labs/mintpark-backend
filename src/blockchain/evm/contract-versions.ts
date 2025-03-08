// src/config/contract-versions.ts

// Import V2 contracts
import { abi as DIRECT_MINT_NFT_ABI_V2 } from "@artifacts/LaunchNFTV2.sol/LaunchNFTV2.json";
import { bytecode as DIRECT_MINT_NFT_BYTECODE_V2 } from "@artifacts/LaunchNFTV2.sol/LaunchNFTV2.json";
// Import V3 contracts
import { abi as DIRECT_MINT_NFT_ABI_V3 } from "@artifacts/LaunchNFTV3.sol/LaunchNFTV3.json";
import { bytecode as DIRECT_MINT_NFT_BYTECODE_V3 } from "@artifacts/LaunchNFTV3.sol/LaunchNFTV3.json";

export interface ContractVersionConfig {
  version: string;
  directMintNftAbi: any;
  directMintNftBytecode: any;
}

export const CONTRACT_VERSIONS_ENUM = {
  V2: "2",
  V3: "3"
};

// Define all contract versions
export const CONTRACT_VERSIONS: { [key: string]: ContractVersionConfig } = {
  [CONTRACT_VERSIONS_ENUM.V2]: {
    version: CONTRACT_VERSIONS_ENUM.V2,
    directMintNftAbi: DIRECT_MINT_NFT_ABI_V2,
    directMintNftBytecode: DIRECT_MINT_NFT_BYTECODE_V2
  },
  [CONTRACT_VERSIONS_ENUM.V3]: {
    version: CONTRACT_VERSIONS_ENUM.V3,
    directMintNftAbi: DIRECT_MINT_NFT_ABI_V3,
    directMintNftBytecode: DIRECT_MINT_NFT_BYTECODE_V3
  }
};

// Default version to use for new deployments
export const DEFAULT_CONTRACT_VERSION = CONTRACT_VERSIONS_ENUM.V3;

// Get contract version config
export function getContractVersionConfig(
  version: string = DEFAULT_CONTRACT_VERSION
): ContractVersionConfig {
  if (!CONTRACT_VERSIONS[version]) {
    throw new Error(`Contract version '${version}' not found`);
  }
  return CONTRACT_VERSIONS[version];
}
