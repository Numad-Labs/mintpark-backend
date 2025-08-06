import { abi as NFT_CONTRACT_ABI } from "@artifacts/MPMNFT.sol/UnifiedNFT.json";
import { bytecode as NFT_CONTRACT_BYTECODE } from "@artifacts/MPMNFT.sol/UnifiedNFT.json";

import { abi as MARKETPLACE_ABI } from "@artifacts/Marketplace.sol/Marketplace.json";
import { bytecode as MARKETPLACE_CONTRACT_BYTECODE } from "@artifacts/Marketplace.sol/Marketplace.json";
import {
  CONTRACT_VERSIONS,
  DEFAULT_CONTRACT_VERSION
} from "./contract-versions";
// import { abi as LAUNCH_NFT_V3_ABI } from "@artifacts/LaunchNFTV3.sol/LaunchNFTV3.json";
// import { abi as PHASE_MANAGER_ABI } from "@artifacts/PhaseManager.sol/PhaseManager.json";
// import { abi as NFT_FACTORY_ABI } from "@artifacts/NFTFactory.sol/NFTFactory.json";

const DEFAULT_PUBLIC_MAX_MINT = 255;

const DEFAULT_ROYALTY_FEE = 250; // 2.5%
const DEFAULT_PLATFORM_FEE = 1000; // 10%
const MAX_FEE = 1000; // 10%
const DEFAULT_SIGN_DEADLINE = 120;

export const PHASE_TYPE_MAP = {
  NOT_STARTED: 0,
  WHITELIST: 1,
  PUBLIC: 2
};

const defaultVersion = CONTRACT_VERSIONS[DEFAULT_CONTRACT_VERSION];

export interface EVMChainConfig {
  RPC_URL: string;
  SUBGRAPH_URL?: string;
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
  // LAUNCH_NFT_V3_ABI: any;
  DIRECT_MINT_NFT_ABI: any;
  // PHASE_MANAGER_ABI: any;
  // NFT_FACTORY_ABI: any;
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
  DIRECT_MINT_NFT_ABI: defaultVersion.directMintNftAbi,
  DIRECT_MINT_NFT_BYTECODE: defaultVersion.directMintNftBytecode,
  DEFAULT_SIGN_DEADLINE,
  // LAUNCH_NFT_V3_ABI,
  // PHASE_MANAGER_ABI,
  // NFT_FACTORY_ABI,
  // PHASE_TYPE_MAP,
  CHAINS: {
    "5115": {
      RPC_URL: "https://rpc.testnet.citrea.xyz",
      CHAIN_ID: 5115,
      MARKETPLACE_ADDRESS: "0xdb6bFA2e6184EbdE089c314B1550f21C7FD93662",
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
    "1114": {
      RPC_URL: "https://rpc.test2.btcs.network",
      CHAIN_ID: 1114,
      MARKETPLACE_ADDRESS: "0x6D95d0879da470305Af2418E8d34C6D12d23C7ea",
      DEFAULT_PUBLIC_MAX_MINT,
      DEFAULT_ROYALTY_FEE,
      DEFAULT_PLATFORM_FEE,
      MAX_FEE,
      useLegacyGas: false
    },
    "1116": {
      RPC_URL: "https://api.zan.top/core-mainnet",
      CHAIN_ID: 1116,
      MARKETPLACE_ADDRESS: "0xcbE3e05Af398bbBC3EfD549D6AfBc16b68F6AE3D",
      DEFAULT_PUBLIC_MAX_MINT,
      DEFAULT_ROYALTY_FEE,
      DEFAULT_PLATFORM_FEE,
      MAX_FEE,
      useLegacyGas: false
    },
    "743111": {
      RPC_URL: `https://testnet.rpc.hemi.network/rpc`,
      // SUBGRAPH_URL:
      //   "https://api.studio.thegraph.com/query/107108/mintpark-mkt-hemi-sepolia/y",
      CHAIN_ID: 743111,
      MARKETPLACE_ADDRESS: "0x07057191b12Ea36DF999512a409783a106DB1b7a",
      DEFAULT_PUBLIC_MAX_MINT,
      DEFAULT_ROYALTY_FEE,
      DEFAULT_PLATFORM_FEE,
      MAX_FEE,
      useLegacyGas: true,
      gasPriceMultiplier: 1.1
    },
    "43111": {
      RPC_URL: `https://rpc.hemi.network/rpc`,
      SUBGRAPH_URL:
        "https://api.studio.thegraph.com/query/108155/mint-park-marketplace/v0.0.2",
      CHAIN_ID: 43111,
      MARKETPLACE_ADDRESS: "0x4e5EF0196ed5C5bc936E31C7c837d315E66059fF",
      DEFAULT_PUBLIC_MAX_MINT,
      DEFAULT_ROYALTY_FEE,
      DEFAULT_PLATFORM_FEE,
      MAX_FEE,
      useLegacyGas: false,
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
    },
    "656476": {
      RPC_URL: "https://open-campus-codex-sepolia.drpc.org",
      CHAIN_ID: 656476,
      MARKETPLACE_ADDRESS: "",
      DEFAULT_PUBLIC_MAX_MINT,
      DEFAULT_ROYALTY_FEE,
      DEFAULT_PLATFORM_FEE,
      MAX_FEE,
      useLegacyGas: false
      // gasPriceMultiplier: 1.1
    },
    "41923": {
      RPC_URL: "https://rpc.edu-chain.raas.gelato.cloud",
      CHAIN_ID: 41923,
      MARKETPLACE_ADDRESS: "",
      DEFAULT_PUBLIC_MAX_MINT,
      DEFAULT_ROYALTY_FEE,
      DEFAULT_PLATFORM_FEE,
      MAX_FEE,
      useLegacyGas: false
      // gasPriceMultiplier: 1.1
    }
  }
};
