import { abi as NFT_CONTRACT_ABI } from "../evm/artifacts/contracts/MPMNFT.sol/MPMNFT.json";
import { bytecode as NFT_CONTRACT_BYTECODE } from "../evm/artifacts/contracts/MPMNFT.sol/MPMNFT.json";
import { abi as MARKETPLACE_ABI } from "../evm/artifacts/contracts/MarketplaceContract.sol/MarketplaceContract.json";
import { bytecode as MARKETPLACE_CONTRACT_BYTECODE } from "../evm/artifacts/contracts/MarketplaceContract.sol/MarketplaceContract.json";

const MARKETPLACE_ADDRESS = "0x68ab2c4aaeE229897aB30B4017dab8e36314e1a8";
const RPC_URL = "https://rpc.testnet.citrea.xyz";
const CHAIN_ID = 5115;

const EVM_CONFIG = {
  MARKETPLACE_ABI,
  MARKETPLACE_CONTRACT_BYTECODE,
  MARKETPLACE_ADDRESS,
  RPC_URL,
  NFT_CONTRACT_ABI,
  NFT_CONTRACT_BYTECODE,
  CHAIN_ID,
};

export { EVM_CONFIG };
