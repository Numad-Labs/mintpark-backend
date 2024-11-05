import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.27",
  networks: {
    hardhat: {
      chainId: 5115,
    },
  },
  paths: {
    // sources: "./contracts/v2",
    tests: "./blockchain/evm/test",
    cache: "./blockchain/evm/cache",
    artifacts: "./blockchain/evm/artifacts",
  },
};

export default config;
