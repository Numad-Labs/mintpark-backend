import { abi as NFT_CONTRACT_ABI } from "../evm/artifacts/src/blockchain/evm/contracts/MPMNFT.sol/UnifiedNFT.json";
import { bytecode as NFT_CONTRACT_BYTECODE } from "../evm/artifacts/src/blockchain/evm/contracts/MPMNFT.sol/UnifiedNFT.json";

import { abi as MARKETPLACE_ABI } from "../evm/artifacts/src/blockchain/evm/contracts/MarketplaceWithPhase.sol/Marketplace.json";
import { bytecode as MARKETPLACE_CONTRACT_BYTECODE } from "../evm/artifacts/src/blockchain/evm/contracts/MarketplaceWithPhase.sol/Marketplace.json";
// import { abi as DIRECT_MINT_NFT_ABI } from "../evm/artifacts/src/blockchain/evm/contracts/DirectMintNFT.sol/LaunchNFT.json";
// import { bytecode as DIRECT_MINT_NFT_BYTECODE } from "../evm/artifacts/src/blockchain/evm/contracts/DirectMintNFT.sol/LaunchNFT.json";
import { abi as DIRECT_MINT_NFT_ABI } from "../evm/artifacts/src/blockchain/evm/contracts/DirectMintNFTV2.sol/LaunchNFTV2.json";
import { bytecode as DIRECT_MINT_NFT_BYTECODE } from "../evm/artifacts/src/blockchain/evm/contracts/DirectMintNFTV2.sol/LaunchNFTV2.json";

const DEFAULT_PUBLIC_MAX_MINT = 255;

const DEFAULT_ROYALTY_FEE = 250; // 2.5%
const DEFAULT_PLATFORM_FEE = 300; // 3%
const MAX_FEE = 1000; // 10%
const DEFAULT_SIGN_DEADLINE = Math.floor(Date.now() / 1000) - 120;

export const PHASE_TYPE_MAP = {
  NOT_STARTED: 0,
  WHITELIST: 1,
  PUBLIC: 2
};

export interface EVMChainConfig {
  RPC_URL: string;
  CHAIN_ID: number;
  MARKETPLACE_ADDRESS: string;
  DEFAULT_PUBLIC_MAX_MINT: number;
  DEFAULT_ROYALTY_FEE: number;
  DEFAULT_PLATFORM_FEE: number;
  MAX_FEE: number;
  useLegacyGas: boolean;
  gasPriceMultiplier?: number;
}

interface EVMConfig {
  NFT_CONTRACT_ABI: any;
  NFT_CONTRACT_BYTECODE: any;
  MARKETPLACE_ABI: any;
  MARKETPLACE_CONTRACT_BYTECODE: any;
  DIRECT_MINT_NFT_ABI: any;
  DIRECT_MINT_NFT_BYTECODE: any;
  DEFAULT_SIGN_DEADLINE: number;
  CHAINS: {
    [key: string]: EVMChainConfig;
  };
}

export const EVM_CONFIG: EVMConfig = {
  NFT_CONTRACT_ABI,
  NFT_CONTRACT_BYTECODE,
  MARKETPLACE_ABI,
  MARKETPLACE_CONTRACT_BYTECODE,
  DIRECT_MINT_NFT_ABI,
  DIRECT_MINT_NFT_BYTECODE,
  DEFAULT_SIGN_DEADLINE,
  // PHASE_TYPE_MAP,
  CHAINS: {
    "5115": {
      RPC_URL: "https://rpc.testnet.citrea.xyz",
      CHAIN_ID: 5115,
      MARKETPLACE_ADDRESS: "0x3415be106ea2680deDD2A6F1BB6B93d1111F44dC",
      DEFAULT_PUBLIC_MAX_MINT,
      DEFAULT_ROYALTY_FEE,
      DEFAULT_PLATFORM_FEE,
      MAX_FEE,
      useLegacyGas: false
    },
    "11155111": {
      RPC_URL: "https://eth-sepolia.public.blastapi.io",
      CHAIN_ID: 11155111,
      MARKETPLACE_ADDRESS: "YOUR_SEPOLIA_MARKETPLACE_ADDRESS",
      DEFAULT_PUBLIC_MAX_MINT,
      DEFAULT_ROYALTY_FEE,
      DEFAULT_PLATFORM_FEE,
      MAX_FEE,
      useLegacyGas: false
    },

    "2442": {
      RPC_URL: "https://rpc.cardona.zkevm-rpc.com",
      CHAIN_ID: 2442,
      MARKETPLACE_ADDRESS: "0x98110Ad5C4428C473bBbD873536c43683F38F2E8",
      DEFAULT_PUBLIC_MAX_MINT,
      DEFAULT_ROYALTY_FEE,
      DEFAULT_PLATFORM_FEE,
      MAX_FEE,
      useLegacyGas: true
      // gasPriceMultiplier: 1.1
    },
    "743111": {
      RPC_URL: "https://testnet.rpc.hemi.network/rpc",
      CHAIN_ID: 743111,
      MARKETPLACE_ADDRESS: "0x07057191b12Ea36DF999512a409783a106DB1b7a",
      DEFAULT_PUBLIC_MAX_MINT,
      DEFAULT_ROYALTY_FEE,
      DEFAULT_PLATFORM_FEE,
      MAX_FEE,
      useLegacyGas: true,
      gasPriceMultiplier: 1.1
    },
    "31337": {
      RPC_URL: "http://127.0.0.1:8545",
      CHAIN_ID: 31337,
      MARKETPLACE_ADDRESS: "0x07057191b12Ea36DF999512a409783a106DB1b7a",
      DEFAULT_PUBLIC_MAX_MINT,
      DEFAULT_ROYALTY_FEE,
      DEFAULT_PLATFORM_FEE,
      MAX_FEE,
      useLegacyGas: false
      // gasPriceMultiplier: 1.1
    }
  }
};
