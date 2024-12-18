import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.27",
  typechain: {
    outDir: "./blockchain/evm/typechain-types",
    target: "ethers-v6",
  },
  networks: {
    hardhat: {
      chainId: 5115,
    },
  },
  paths: {
    sources: "./blockchain/evm/contracts",
    tests: "./blockchain/evm/test",
    cache: "./blockchain/evm/cache",
    artifacts: "./blockchain/evm/artifacts",
  },
};

export default config;
