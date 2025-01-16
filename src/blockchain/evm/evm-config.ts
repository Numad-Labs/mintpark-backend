import { abi as NFT_CONTRACT_ABI } from "../evm/artifacts/src/blockchain/evm/contracts/MPMNFT.sol/UnifiedNFT.json";
import { bytecode as NFT_CONTRACT_BYTECODE } from "../evm/artifacts/src/blockchain/evm/contracts/MPMNFT.sol/UnifiedNFT.json";

// import { abi as MARKETPLACE_ABI } from "../evm/artifacts/blockchain/evm/contracts/MarketplaceContract.sol/MarketplaceContract.json";
// import { bytecode as MARKETPLACE_CONTRACT_BYTECODE } from "../evm/artifacts/blockchain/evm/contracts/MarketplaceContract.sol/MarketplaceContract.json";
import { abi as MARKETPLACE_ABI } from "../evm/artifacts/src/blockchain/evm/contracts/MarketplaceWithPhase.sol/Marketplace.json";
import { bytecode as MARKETPLACE_CONTRACT_BYTECODE } from "../evm/artifacts/src/blockchain/evm/contracts/MarketplaceWithPhase.sol/Marketplace.json";

const MARKETPLACE_ADDRESS = "0x3415be106ea2680deDD2A6F1BB6B93d1111F44dC";
const RPC_URL = "https://rpc.testnet.citrea.xyz";
const CHAIN_ID = 5115;
const DEFAULT_PUBLIC_MAX_MINT = 255;

const DEFAULT_ROYALTY_FEE = 250; // 2.5%
const DEFAULT_PLATFORM_FEE = 300; // 3%
const MAX_FEE = 1000; // 10%

const EVM_CONFIG = {
  MARKETPLACE_ABI,
  MARKETPLACE_CONTRACT_BYTECODE,
  MARKETPLACE_ADDRESS,
  RPC_URL,
  NFT_CONTRACT_ABI,
  NFT_CONTRACT_BYTECODE,

  CHAIN_ID,
  DEFAULT_PUBLIC_MAX_MINT,
  DEFAULT_ROYALTY_FEE,
  DEFAULT_PLATFORM_FEE,
  MAX_FEE
};

export { EVM_CONFIG };
