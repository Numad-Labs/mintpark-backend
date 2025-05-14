import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  typechain: {
    outDir: "./src/blockchain/evm/typechain-types",
    target: "ethers-v6"
  },

  networks: {
    hardhat: {
      chainId: 5115
    },
    "hemi-sepolia": {
      url: "https://testnet.rpc.hemi.network/rpc" // Hemi testnet RPC URL
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
      "hemi-sepolia": "blockscout" // Using "blockscout" as the API key
    },
    customChains: [
      {
        network: "hemi-sepolia",
        chainId: 743111,
        urls: {
          apiURL: "https://testnet.explorer.hemi.xyz/api",
          browserURL: "https://testnet.explorer.hemi.xyz"
        }
      }
    ]
  },
  sourcify: {
    enabled: false
  }
};

export default config;
