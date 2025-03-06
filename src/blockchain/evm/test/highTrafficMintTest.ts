// import { expect } from "chai";
// import { ethers } from "hardhat";
// import { LaunchNFTV2 } from "../typechain-types";
// import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
// import { mine } from "@nomicfoundation/hardhat-network-helpers";
// import { ContractTransactionResponse } from "ethers";

// describe("High Traffic Scenarios", () => {
//   let contract: LaunchNFTV2;
//   let owner: SignerWithAddress;
//   let backendSigner: SignerWithAddress;
//   let platformFeeRecipient: SignerWithAddress;
//   let minters: SignerWithAddress[];
//   let globalTimestamp: number;
//   let currentTimestamp: number; // Track the latest timestamp we've used

//   const INITIAL_ROYALTY_FEE = 500; // 5%
//   const INITIAL_PLATFORM_FEE = 250; // 2.5%
//   const CONTRACT_NAME = "Traffic Test NFT";
//   const CONTRACT_SYMBOL = "TTNFT";

//   before(async () => {
//     await ethers.provider.send("hardhat_reset", [
//       {
//         allowBlocksWithSameTimestamp: true
//       }
//     ]);

//     // Create multiple signers for testing
//     const allSigners = await ethers.getSigners();

//     // Assign roles
//     owner = allSigners[0];
//     backendSigner = allSigners[1];
//     platformFeeRecipient = allSigners[2];

//     // Use other signers as minters (maximum 10 for practical tests)
//     minters = allSigners.slice(3, 13);

//     const latestBlock = await ethers.provider.getBlock("latest");
//     globalTimestamp = Number(latestBlock!.timestamp);
//     currentTimestamp = globalTimestamp;
//   });

//   after(async () => {
//     await ethers.provider.send("hardhat_reset", []);
//   });

//   // Helper function to advance time safely
//   async function advanceTime(seconds: number) {
//     currentTimestamp += seconds;
//     await ethers.provider.send("evm_setNextBlockTimestamp", [currentTimestamp]);
//     await mine();
//     return currentTimestamp;
//   }

//   async function deployContract() {
//     const Factory = await ethers.getContractFactory("LaunchNFTV2", owner);
//     contract = await Factory.deploy(
//       await owner.getAddress(),
//       CONTRACT_NAME,
//       CONTRACT_SYMBOL,
//       INITIAL_ROYALTY_FEE,
//       INITIAL_PLATFORM_FEE,
//       await platformFeeRecipient.getAddress(),
//       await backendSigner.getAddress()
//     );
//     await contract.waitForDeployment();
//     await mine();

//     // Update currentTimestamp
//     const latestBlock = await ethers.provider.getBlock("latest");
//     currentTimestamp = Number(latestBlock!.timestamp);
//   }

//   async function setupUnlimitedPhase() {
//     // Add public phase with no supply or wallet limits
//     await contract.connect(owner).addPhase(
//       2, // PUBLIC
//       ethers.parseEther("0.1"),
//       BigInt(currentTimestamp),
//       BigInt(currentTimestamp + 86400),
//       0, // Unlimited supply
//       0, // Unlimited per wallet
//       ethers.ZeroHash
//     );

//     // Move to phase
//     await advanceTime(10);

//     // Return active phase index
//     const [phaseIndex] = await contract.getActivePhase();
//     return phaseIndex;
//   }

//   async function generateSignature(
//     minterAddress: string,
//     tokenId: string,
//     uri: string,
//     price: string,
//     phaseIndex: number,
//     customTimestamp?: number
//   ) {
//     const domain = {
//       name: "UnifiedNFT",
//       version: "1",
//       chainId: (await ethers.provider.getNetwork()).chainId,
//       verifyingContract: await contract.getAddress()
//     };

//     // Create uniqueId with consistent but unique input
//     const uniqueIdBase = Date.now() + parseInt(tokenId);
//     const uniqueId = ethers.keccak256(
//       ethers.solidityPacked(
//         ["address", "uint256", "string", "uint256"],
//         [minterAddress, tokenId, uri, uniqueIdBase]
//       )
//     );

//     // Use provided timestamp or current one
//     const timestamp = customTimestamp || currentTimestamp;

//     const types = {
//       MintRequest: [
//         { name: "minter", type: "address" },
//         { name: "tokenId", type: "uint256" },
//         { name: "uri", type: "string" },
//         { name: "price", type: "uint256" },
//         { name: "phaseIndex", type: "uint256" },
//         { name: "uniqueId", type: "bytes32" },
//         { name: "timestamp", type: "uint256" }
//       ]
//     };

//     const value = {
//       minter: minterAddress,
//       tokenId: tokenId,
//       uri: uri,
//       price: ethers.parseEther(price),
//       phaseIndex: phaseIndex,
//       uniqueId: uniqueId,
//       timestamp: timestamp
//     };

//     const signature = await backendSigner.signTypedData(domain, types, value);
//     return { signature, uniqueId, timestamp };
//   }

//   beforeEach(async () => {
//     await deployContract();
//   });

//   it("should handle multiple sequential mints", async () => {
//     // Setup phase with no limits
//     const phaseIndex = await setupUnlimitedPhase();

//     // Number of mints to perform
//     const numMints = 10;

//     // Store initial balances for fee validation
//     const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
//     const initialPlatformBalance = await ethers.provider.getBalance(
//       platformFeeRecipient.address
//     );

//     // Mint sequentially
//     for (let i = 1; i <= numMints; i++) {
//       const tokenId = i.toString();
//       const uri = `ipfs://traffic${i}`;

//       // Use different minters (cycling through available ones)
//       const minterIndex = (i - 1) % minters.length;
//       const minter = minters[minterIndex];

//       // Advance time for each mint to avoid timestamp conflicts
//       await advanceTime(60); // Add 1 minute between mints

//       const { signature, uniqueId, timestamp } = await generateSignature(
//         minter.address,
//         tokenId,
//         uri,
//         "0.1",
//         Number(phaseIndex),
//         currentTimestamp
//       );

//       await contract
//         .connect(minter)
//         .mint(tokenId, uri, uniqueId, timestamp, signature, [], {
//           value: ethers.parseEther("0.1")
//         });
//     }

//     // Verify all tokens were minted
//     expect(await contract.totalSupply()).to.equal(numMints);

//     // Verify owner and platform received correct fees
//     const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
//     const finalPlatformBalance = await ethers.provider.getBalance(
//       platformFeeRecipient.address
//     );

//     const totalMintValue = ethers.parseEther("0.1") * BigInt(numMints);
//     const expectedPlatformFee =
//       (totalMintValue * BigInt(INITIAL_PLATFORM_FEE)) / BigInt(10000);
//     const expectedOwnerAmount = totalMintValue - expectedPlatformFee;

//     expect(finalPlatformBalance - initialPlatformBalance).to.equal(
//       expectedPlatformFee
//     );
//     expect(finalOwnerBalance - initialOwnerBalance).to.equal(
//       expectedOwnerAmount
//     );
//   });

//   it("should handle a reasonable number of concurrent mints", async () => {
//     // Setup phase with no limits
//     const phaseIndex = await setupUnlimitedPhase();

//     // Number of concurrent mints to attempt (reduced for practical testing)
//     const numMints = 5;

//     // Store initial balances for fee validation
//     const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
//     const initialPlatformBalance = await ethers.provider.getBalance(
//       platformFeeRecipient.address
//     );

//     // Advance time before generating signatures
//     await advanceTime(60);
//     const baseTimestamp = currentTimestamp;

//     // Prepare all mint data
//     const mintData = [];

//     for (let i = 1; i <= numMints; i++) {
//       const tokenId = i.toString();
//       const uri = `ipfs://concurrent${i}`;

//       // Use different minters (cycling through available ones)
//       const minterIndex = (i - 1) % minters.length;
//       const minter = minters[minterIndex];

//       const { signature, uniqueId } = await generateSignature(
//         minter.address,
//         tokenId,
//         uri,
//         "0.1",
//         Number(phaseIndex),
//         baseTimestamp
//       );

//       mintData.push({
//         minter,
//         tokenId,
//         uri,
//         uniqueId,
//         signature
//       });
//     }

//     // Execute mints sequentially but with the same timestamp to simulate concurrent behavior
//     for (const data of mintData) {
//       await contract
//         .connect(data.minter)
//         .mint(
//           data.tokenId,
//           data.uri,
//           data.uniqueId,
//           baseTimestamp,
//           data.signature,
//           [],
//           { value: ethers.parseEther("0.1") }
//         );
//     }

//     // Verify all tokens were minted
//     expect(await contract.totalSupply()).to.equal(numMints);

//     // Verify fees distributed correctly
//     const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
//     const finalPlatformBalance = await ethers.provider.getBalance(
//       platformFeeRecipient.address
//     );

//     const totalMintValue = ethers.parseEther("0.1") * BigInt(numMints);
//     const expectedPlatformFee =
//       (totalMintValue * BigInt(INITIAL_PLATFORM_FEE)) / BigInt(10000);
//     const expectedOwnerAmount = totalMintValue - expectedPlatformFee;

//     expect(finalPlatformBalance - initialPlatformBalance).to.equal(
//       expectedPlatformFee
//     );
//     expect(finalOwnerBalance - initialOwnerBalance).to.equal(
//       expectedOwnerAmount
//     );
//   });
// });
