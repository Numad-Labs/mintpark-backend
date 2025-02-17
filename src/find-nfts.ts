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
  const provider = new ethers.JsonRpcProvider(
    "https://testnet.rpc.hemi.network/rpc"
  );
  const wallet = new ethers.Wallet(privateKey, provider);

  const tx = await wallet.sendTransaction(unsignedTx);
  const receipt = await tx.wait();
  if (!receipt) throw new Error("Error sending transaction");
  console.log("Transaction confirmed:", receipt.hash);
  return receipt;
}

signAndSendWithPrivateKey(
  {
    from: "0x62a64ad869909f0346023dbcecb6ff635dc93bb6",
    data: "0x88afad08000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000067b0b1390000000000000000000000000000000000000000000000000000000067b202b900000000000000000000000000000000000000000000000000000000000003e800000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000000",
    value: "0x0",
    gasLimit: "174948",
    nonce: 11,
    chainId: "743111",
    gasPrice: "26551210776",
    type: 0,
    to: "0x582BbFAEac0017F4547ee64C74048Fd9BFbCc0Af"
  },
  "c3c5f37331cb00fee1f2afb6ef03d6fe960a3b9b31bd88f2200e73f210c11d29"
);
