import { EVM_CONFIG } from "./blockchain/evm/evm-config";
import { launchItemRepository } from "./repositories/launchItemRepository";
import { Contract, ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://rpc.testnet.citrea.xyz");
const contractAddress = "0x6C3729b780F447D5DF56841a7F0f9F6C409275DE";

const contract = new Contract(
  contractAddress,
  EVM_CONFIG.NFT_CONTRACT_ABI,
  provider
);

async function findNftId() {
  const nftIds =
    await launchItemRepository.getActiveLaunchItemsWithCollectibleId(
      "0f1455e1-a5b0-4177-970c-e8f58f3a01f7"
    );

  console.log(nftIds.length);

  const totalSupply = 5000;

  const allOnChainIds: string[] = [];
  for (let i = 1; i <= totalSupply; i++) {
    let isValid = true;
    try {
      const owner = await contract.ownerOf(3171);
    } catch (e) {
      isValid = false;
    }

    if (isValid) allOnChainIds.push(i.toString());
  }

  console.log(allOnChainIds.length);

  //   // Find missing NFTs
  //   const nftSet = new Set(nftIds);
  //   const missingNFTs = allOnChainIds.filter((id) => !nftSet.has({ nftId: id }));

  //   console.log("Missing NFTs:", missingNFTs);

  //   return missingNFTs;
}

findNftId();
