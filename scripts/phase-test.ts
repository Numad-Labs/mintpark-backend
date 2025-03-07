// import { EVM_CONFIG } from "./blockchain/evm/evm-config";
// import { launchItemRepository } from "./repositories/launchItemRepository";
// import { Contract, ethers } from "ethers";

import { ethers } from "ethers";

// const provider = new ethers.JsonRpcProvider("https://rpc.testnet.citrea.xyz");
// const contractAddress = "0x6C3729b780F447D5DF56841a7F0f9F6C409275DE";

// const contract = new Contract(
//   contractAddress,
//   EVM_CONFIG.NFT_CONTRACT_ABI,
//   provider
// );

// async function findNftId() {
//   const nftIds =
//     await launchItemRepository.getActiveLaunchItemsWithCollectibleId(
//       "0f1455e1-a5b0-4177-970c-e8f58f3a01f7"
//     );

//   console.log(nftIds.length);

//   const totalSupply = 5000;

//   const allOnChainIds: string[] = [];
//   for (let i = 1; i <= totalSupply; i++) {
//     let isValid = true;
//     try {
//       const owner = await contract.ownerOf(3171);
//     } catch (e) {
//       isValid = false;
//     }

//     if (isValid) allOnChainIds.push(i.toString());
//   }

//   console.log(allOnChainIds.length);

//   //   // Find missing NFTs
//   //   const nftSet = new Set(nftIds);
//   //   const missingNFTs = allOnChainIds.filter((id) => !nftSet.has({ nftId: id }));

//   //   console.log("Missing NFTs:", missingNFTs);

//   //   return missingNFTs;
// }

// findNftId();

async function signAndSendWithPrivateKey(unsignedTx: any, privateKey: string) {
  const provider = new ethers.JsonRpcProvider("https://rpc.testnet.citrea.xyz");
  const wallet = new ethers.Wallet(privateKey, provider);

  const tx = await wallet.sendTransaction(unsignedTx);
  const receipt = await tx.wait();
  if (!receipt) throw new Error("Error sending transaction");
  console.log("Transaction confirmed:", receipt.hash);
  return receipt;
}

signAndSendWithPrivateKey(
  {
    from: "0x67be758792785eab5622dbc08e369b207fff01eb",
    data: "0xe4a739600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000001b48eb57e0000000000000000000000000000000000000000000000000000000000067c9c6800000000000000000000000000000000000000000000000000000000067f2a3d400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002",
    value: "0x0",
    nonce: 65,
    chainId: "5115",
    to: "0xe99860373D9107EAed60faC6a710D2D5b8522268",
    maxFeePerGas: "21757760",
    maxPriorityFeePerGas: "100",
    type: 2
  },
  "3f72b2d6efbe689eb61859741f1f0ea29d5e554daf047c1df43d5d1d6186362c"
);
