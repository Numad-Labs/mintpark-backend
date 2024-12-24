// import { expect } from "chai";
// import { ethers } from "hardhat";
// import { MPMNFT, MarketplaceWithPhase } from "../typechain-types";
// import { TransactionValidationService } from "../services/evmTransactionValidationService";

// describe("TransactionValidationService - Buy Validation", function () {
//   let nftContract: MPMNFT;
//   let marketplaceContract: MarketplaceWithPhase;
//   let owner: any;
//   let seller: any;
//   let buyer: any;
//   let validationService: TransactionValidationService;

//   const TOKEN_ID = "1";
//   const MINT_FEE = ethers.parseEther("0.1");
//   const LISTING_PRICE = ethers.parseEther("1.0");
//   const TOKEN_URI = "ipfs://test-uri";
//   const MARKETPLACE_FEE = 250; // 2.5%
//   const PUBLIC_MAX_MINT = 5; // Default public max mint
//   const EMPTY_BYTES32_ARRAY: `0x${string}`[] = []; // Empty merkle proof for public phase

//   beforeEach(async function () {
//     [owner, seller, buyer] = await ethers.getSigners();

//     // Deploy NFT contract
//     const NFTFactory = await ethers.getContractFactory("MPMNFT");
//     nftContract = (await NFTFactory.deploy(
//       await owner.getAddress(),
//       "Test NFT",
//       "TNFT",
//       MINT_FEE
//     )) as MPMNFT;
//     await nftContract.waitForDeployment();

//     // Deploy Marketplace contract
//     const MarketplaceFactory = await ethers.getContractFactory(
//       "MarketplaceWithPhase"
//     );
//     marketplaceContract = (await MarketplaceFactory.deploy(
//       owner.getAddress(),
//       0
//     )) as MarketplaceWithPhase;
//     await marketplaceContract.waitForDeployment();

//     // Register collection with public phase only
//     await marketplaceContract.registerCollection(
//       await nftContract.getAddress(),
//       PUBLIC_MAX_MINT
//     );

//     // Mint NFT to seller
//     await nftContract
//       .connect(seller)
//       .mint(TOKEN_ID, TOKEN_URI, { value: MINT_FEE });

//     // Initialize validation service
//     validationService = new TransactionValidationService(
//       "http://127.0.0.1:8545"
//     );
//   });

//   describe("Buy Transaction Validation", function () {
//     it("Should validate successful buy transaction", async function () {
//       // Approve marketplace
//       await nftContract
//         .connect(seller)
//         .setApprovalForAll(await marketplaceContract.getAddress(), true);

//       // Create listing
//       await marketplaceContract
//         .connect(seller)
//         .createListing(await nftContract.getAddress(), TOKEN_ID, LISTING_PRICE);

//       // Purchase listing with empty merkle proof
//       const buyTx = await marketplaceContract
//         .connect(buyer)
//         .purchaseListing(1, EMPTY_BYTES32_ARRAY, { value: LISTING_PRICE });
//       const receipt = await buyTx.wait();

//       if (!receipt) return;

//       // Validate transaction
//       const isValid = await validationService.validateBuyTransaction(
//         receipt.hash,
//         { address: await buyer.getAddress() },
//         { address: await seller.getAddress() },
//         await nftContract.getAddress(),
//         TOKEN_ID,
//         ethers.formatEther(LISTING_PRICE)
//       );

//       expect(isValid).to.be.true;
//     });

//     it("Should reject validation for non-existent transaction", async function () {
//       const fakeTxHash =
//         "0x1234567890123456789012345678901234567890123456789012345678901234";

//       await expect(
//         validationService.validateBuyTransaction(
//           fakeTxHash,
//           { address: await buyer.getAddress() },
//           { address: await seller.getAddress() },
//           await nftContract.getAddress(),
//           TOKEN_ID,
//           ethers.formatEther(LISTING_PRICE)
//         )
//       ).to.be.rejectedWith("Transaction not found");
//     });

//     it("Should reject validation for incorrect payment amount", async function () {
//       // Approve and create listing
//       await nftContract
//         .connect(seller)
//         .setApprovalForAll(await marketplaceContract.getAddress(), true);
//       await marketplaceContract
//         .connect(seller)
//         .createListing(await nftContract.getAddress(), TOKEN_ID, LISTING_PRICE);

//       // Try to buy with incorrect amount
//       const incorrectPrice = LISTING_PRICE - ethers.parseEther("0.5");
//       try {
//         const buyTx = await marketplaceContract
//           .connect(buyer)
//           .purchaseListing(1, EMPTY_BYTES32_ARRAY, { value: incorrectPrice });
//         await buyTx.wait();
//         expect.fail("Transaction should have failed");
//       } catch (error: any) {
//         if (error.message.includes("Transaction should have failed")) {
//           throw error;
//         }
//         expect(error.message).to.include("Insufficient payment");
//       }
//     });

//     it("Should reject validation for wrong buyer", async function () {
//       await nftContract
//         .connect(seller)
//         .setApprovalForAll(await marketplaceContract.getAddress(), true);
//       await marketplaceContract
//         .connect(seller)
//         .createListing(await nftContract.getAddress(), TOKEN_ID, LISTING_PRICE);

//       const buyTx = await marketplaceContract
//         .connect(buyer)
//         .purchaseListing(1, EMPTY_BYTES32_ARRAY, { value: LISTING_PRICE });
//       const receipt = await buyTx.wait();
//       if (!receipt) return;

//       await expect(
//         validationService.validateBuyTransaction(
//           receipt.hash,
//           { address: await seller.getAddress() }, // Wrong buyer
//           { address: await seller.getAddress() },
//           await nftContract.getAddress(),
//           TOKEN_ID,
//           ethers.formatEther(LISTING_PRICE)
//         )
//       ).to.be.rejectedWith("Invalid buyer address");
//     });

//     it("Should validate multiple consecutive purchases", async function () {
//       // Mint second token
//       const TOKEN_ID_2 = "2";
//       await nftContract
//         .connect(seller)
//         .mint(TOKEN_ID_2, TOKEN_URI, { value: MINT_FEE });

//       // Approve marketplace for both tokens
//       await nftContract
//         .connect(seller)
//         .setApprovalForAll(await marketplaceContract.getAddress(), true);

//       // Create and purchase first listing
//       await marketplaceContract
//         .connect(seller)
//         .createListing(await nftContract.getAddress(), TOKEN_ID, LISTING_PRICE);
//       const buyTx1 = await marketplaceContract
//         .connect(buyer)
//         .purchaseListing(1, EMPTY_BYTES32_ARRAY, { value: LISTING_PRICE });
//       const receipt1 = await buyTx1.wait();

//       // Create and purchase second listing
//       await marketplaceContract
//         .connect(seller)
//         .createListing(
//           await nftContract.getAddress(),
//           TOKEN_ID_2,
//           LISTING_PRICE
//         );
//       const buyTx2 = await marketplaceContract
//         .connect(buyer)
//         .purchaseListing(2, EMPTY_BYTES32_ARRAY, { value: LISTING_PRICE });
//       const receipt2 = await buyTx2.wait();

//       if (!receipt1 || !receipt2) return;

//       const isValid1 = await validationService.validateBuyTransaction(
//         receipt1.hash,
//         { address: await buyer.getAddress() },
//         { address: await seller.getAddress() },
//         await nftContract.getAddress(),
//         TOKEN_ID,
//         ethers.formatEther(LISTING_PRICE)
//       );

//       const isValid2 = await validationService.validateBuyTransaction(
//         receipt2.hash,
//         { address: await buyer.getAddress() },
//         { address: await seller.getAddress() },
//         await nftContract.getAddress(),
//         TOKEN_ID_2,
//         ethers.formatEther(LISTING_PRICE)
//       );

//       expect(isValid1).to.be.true;
//       expect(isValid2).to.be.true;
//     });
//   });
// });
// describe("TransactionValidationService - Mint validation", function () {
//   let nftContract: MPMNFT;
//   let owner: any;
//   let minter: any;
//   let validationService: TransactionValidationService;
//   const MINT_FEE = ethers.parseEther("0.1");
//   const TOKEN_NAME = "Test NFT";
//   const TOKEN_SYMBOL = "TNFT";

//   beforeEach(async function () {
//     [owner, minter] = await ethers.getSigners();

//     // Deploy NFT contract
//     const NFTFactory = await ethers.getContractFactory("MPMNFT");
//     nftContract = (await NFTFactory.deploy(
//       await owner.getAddress(),
//       TOKEN_NAME,
//       TOKEN_SYMBOL,
//       MINT_FEE
//     )) as MPMNFT;
//     await nftContract.waitForDeployment();

//     // Initialize validation service with hardhat's provider URL
//     validationService = new TransactionValidationService(
//       "http://localhost:8545"
//     );
//   });

//   describe("Collection Mint Validation", function () {
//     it("Should validate successful single mint transaction", async function () {
//       // Perform single mint with correct fee
//       const tx = await nftContract
//         .connect(minter)
//         .mint(1, "uri1", { value: MINT_FEE });
//       const receipt = await tx.wait();

//       if (!receipt) return;

//       const isValid = await validationService.validateCollectionMintTransaction(
//         receipt.hash,
//         await minter.getAddress(),
//         1,
//         await nftContract.getAddress()
//       );

//       expect(isValid).to.be.true;
//     });

//     it("Should validate successful batch mint from owner", async function () {
//       // Check if owner is correctly set
//       const contractOwner = await nftContract.owner();
//       expect(contractOwner.toLowerCase()).to.equal(
//         (await owner.getAddress()).toLowerCase()
//       );

//       const quantity = 3;
//       const uris = ["uri1", "uri2", "uri3"];

//       // Perform batch mint as owner
//       const tx = await nftContract
//         .connect(owner)
//         .batchMint(await minter.getAddress(), quantity, uris);
//       const receipt = await tx.wait();

//       // Log relevant information for debugging
//       console.log("Transaction from:", tx.from);
//       console.log("Contract owner:", contractOwner);
//       console.log("Minter address:", await minter.getAddress());
//       if (!receipt) return;

//       // Validate the transaction
//       const isValid = await validationService.validateCollectionMintTransaction(
//         receipt.hash,
//         await minter.getAddress(),
//         quantity,
//         await nftContract.getAddress()
//       );

//       expect(isValid).to.be.true;
//     });

//     it("Should reject validation when quantity doesn't match", async function () {
//       // Mint single token
//       const tx = await nftContract
//         .connect(minter)
//         .mint(1, "uri1", { value: MINT_FEE });
//       const receipt = await tx.wait();
//       if (!receipt) return;

//       await expect(
//         validationService.validateCollectionMintTransaction(
//           receipt.hash,
//           await minter.getAddress(),
//           2, // Expected 2 but only minted 1
//           await nftContract.getAddress()
//         )
//       ).to.be.rejectedWith("Expected 2 mints, but found 1");
//     });

//     it("Should reject validation for wrong recipient", async function () {
//       // Owner mints to themselves instead of minter
//       const tx = await nftContract
//         .connect(owner)
//         .safeMint(await owner.getAddress(), 1, "uri1");
//       const receipt = await tx.wait();
//       if (!receipt) return;

//       await expect(
//         validationService.validateCollectionMintTransaction(
//           receipt.hash,
//           await minter.getAddress(), // Wrong recipient
//           1,
//           await nftContract.getAddress()
//         )
//       ).to.be.rejectedWith("Invalid mint: wrong recipient");
//     });

//     it("Should reject validation for insufficient payment", async function () {
//       // Try to mint with insufficient fee
//       const insufficientFee = MINT_FEE / BigInt(2);

//       try {
//         const tx = await nftContract
//           .connect(minter)
//           .mint(1, "uri1", { value: insufficientFee });
//         await tx.wait();
//         // Should not reach here
//         expect.fail("Transaction should have failed");
//       } catch (error: any) {
//         if (error.message.includes("Transaction should have failed")) {
//           throw error;
//         }
//         // Transaction failed as expected
//         expect(error.message).to.include("Insufficient payment");
//       }
//     });

//     it("Should handle non-existent transaction", async function () {
//       const fakeTxHash =
//         "0x1234567890123456789012345678901234567890123456789012345678901234";

//       await expect(
//         validationService.validateCollectionMintTransaction(
//           fakeTxHash,
//           await minter.getAddress(),
//           1,
//           await nftContract.getAddress()
//         )
//       ).to.be.rejectedWith("Transaction not found");
//     });

//     it("Should validate multiple consecutive mints", async function () {
//       // First mint
//       const tx1 = await nftContract
//         .connect(minter)
//         .mint(1, "uri1", { value: MINT_FEE });
//       const receipt1 = await tx1.wait();

//       // Second mint
//       const tx2 = await nftContract
//         .connect(minter)
//         .mint(2, "uri2", { value: MINT_FEE });
//       const receipt2 = await tx2.wait();

//       if (!receipt1) return;
//       if (!receipt2) return;

//       // Validate both transactions
//       const isValid1 =
//         await validationService.validateCollectionMintTransaction(
//           receipt1.hash,
//           await minter.getAddress(),
//           1,
//           await nftContract.getAddress()
//         );

//       const isValid2 =
//         await validationService.validateCollectionMintTransaction(
//           receipt2.hash,
//           await minter.getAddress(),
//           1,
//           await nftContract.getAddress()
//         );

//       expect(isValid1).to.be.true;
//       expect(isValid2).to.be.true;
//     });

//     it("Should validate payment for multiple mints", async function () {
//       const quantity = 2;
//       const totalFee = MINT_FEE * BigInt(quantity);

//       // Mint multiple tokens with correct total fee
//       const tx1 = await nftContract
//         .connect(minter)
//         .mint(1, "uri1", { value: MINT_FEE });
//       await tx1.wait();

//       const tx2 = await nftContract
//         .connect(minter)
//         .mint(2, "uri2", { value: MINT_FEE });
//       const receipt2 = await tx2.wait();

//       if (!receipt2) return;

//       const isValid = await validationService.validateCollectionMintTransaction(
//         receipt2.hash,
//         await minter.getAddress(),
//         1,
//         await nftContract.getAddress()
//       );

//       expect(isValid).to.be.true;
//     });
//   });
// });
