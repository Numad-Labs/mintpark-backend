import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

import "@nomicfoundation/hardhat-verify";

import * as dotenv from "dotenv";

dotenv.config();
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26" // Updated to match your contract's version
    // settings: {
    //   optimizer: {
    //     enabled: false, // Should match your original compilation settings
    //     runs: 200
    //   }
    //   // evmVersion: "default"
    //   // evmVersion: "shanghai" // Explicit EVM version for PUSH0 support
    // }
  },
  networks: {
    hemi: {
      url: "https://rpc.hemi.network/rpc"
    },
    citrea: {
      url: "https://rpc.testnet.citrea.xyz",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    core_testnet: {
      url: "https://rpc.test2.btcs.network",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    core_mainnet: {
      url: "https://api.zan.top/core-mainnet",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  },
  paths: {
    sources: "./src/blockchain/evm/contracts",
    tests: "./src/blockchain/evm/test",
    cache: "./src/blockchain/evm/cache",
    artifacts: "./src/blockchain/evm/artifacts"
  },
  etherscan: {
    apiKey: {
      hemi: "blockscout",
      citrea: "blockscout",
      core_testnet: "blockscout",
      core_mainnet: "blockscout"
    },
    customChains: [
      {
        network: "hemi",
        chainId: 43111,
        urls: {
          apiURL: "https://explorer.hemi.xyz/api",
          browserURL: "https://explorer.hemi.xyz"
        }
      },
      {
        network: "citrea",
        chainId: 5115,

        urls: {
          apiURL: "https://explorer.testnet.citrea.xyz/api",
          browserURL: "https://explorer.testnet.citrea.xyz"
        }
      },
      {
        network: "core_testnet",
        chainId: 1114,

        urls: {
          apiURL: "https://rpc.test2.btcs.network/api",
          browserURL: "https://rpc.test2.btcs.network"
        }
      },
      {
        network: "core_mainnet",
        chainId: 1116,

        urls: {
          apiURL: "https://scan.coredao.org/api",
          browserURL: "https://scan.coredao.org/"
        }
      }
    ]
  },
  sourcify: {
    enabled: true,
    // Optional: specify a different Sourcify server
    apiUrl: "https://sourcify.dev/server",
    // Optional: specify a different Sourcify repository
    browserUrl: "https://repo.sourcify.dev"
  }
};

export default config;
