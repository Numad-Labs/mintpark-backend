import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.27",
  typechain: {
    outDir: "./src/blockchain/evm/typechain-types",
    target: "ethers-v6",
  },
  networks: {
    hardhat: {
      chainId: 5115,
    },
  },
  paths: {
    sources: "./src/blockchain/evm/contracts",
    tests: "./src/blockchain/evm/test",
    cache: "./src/blockchain/evm/cache",
    artifacts: "./src/blockchain/evm/artifacts",
  },
};

export default config;
