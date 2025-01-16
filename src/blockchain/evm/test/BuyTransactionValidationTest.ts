// import { expect } from "chai";
// import { ethers } from "hardhat";
// import { MPMNFT, MarketplaceContract } from "../typechain-types";
// import { TransactionValidationService } from "../services/evmTransactionValidationService";

// describe("TransactionValidationService - Buy Validation", function () {
//   let nftContract: MPMNFT;
//   let marketplaceContract: MarketplaceContract;
//   let owner: any;
//   let seller: any;
//   let buyer: any;
//   let validationService: TransactionValidationService;

//   const TOKEN_ID = "1";
//   const MINT_FEE = ethers.parseEther("0.1");
//   const LISTING_PRICE = ethers.parseEther("1.0");
//   const TOKEN_URI = "ipfs://test-uri";

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
//       "MarketplaceContract"
//     );
//     marketplaceContract =
//       (await MarketplaceFactory.deploy()) as MarketplaceContract;
//     await marketplaceContract.waitForDeployment();

//     // Mint NFT to seller
//     await nftContract
//       .connect(seller)
//       .mint(TOKEN_ID, TOKEN_URI, { value: MINT_FEE });

//     // Initialize validation service
//     validationService = new TransactionValidationService(
//       "http://localhost:8545"
//     );
//   });

//   describe("Buy Transaction Validation", function () {
//     it("Should validate successful buy transaction", async function () {
//       // Approve marketplace
//       await nftContract
//         .connect(seller)
//         .setApprovalForAll(await marketplaceContract.getAddress(), true);

//       // List item
//       await marketplaceContract
//         .connect(seller)
//         .listItem(await nftContract.getAddress(), TOKEN_ID, LISTING_PRICE);

//       // Buy item
//       const buyTx = await marketplaceContract
//         .connect(buyer)
//         .buyItem(await nftContract.getAddress(), TOKEN_ID, {
//           value: LISTING_PRICE,
//         });
//       const receipt = await buyTx.wait();

//       // Create mock list object
//       const mockList = {
//         address: await seller.getAddress(),
//       };

//       if (!receipt) return;

//       // Validate transaction
//       const isValid = await validationService.validateBuyTransaction(
//         receipt.hash,
//         mockList,
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
//           { address: await seller.getAddress() },
//           { address: await buyer.getAddress() },
//           { address: await seller.getAddress() },
//           await nftContract.getAddress(),
//           TOKEN_ID,
//           ethers.formatEther(LISTING_PRICE)
//         )
//       ).to.be.rejectedWith("Transaction not found");
//     });

//     it("Should reject validation for failed transaction", async function () {
//       // Try to buy without listing first
//       try {
//         const buyTx = await marketplaceContract
//           .connect(buyer)
//           .buyItem(await nftContract.getAddress(), TOKEN_ID, {
//             value: LISTING_PRICE,
//           });
//         await buyTx.wait();
//         expect.fail("Transaction should have failed");
//       } catch (error: any) {
//         if (error.message.includes("Transaction should have failed")) {
//           throw error;
//         }
//         // Expected to fail
//         expect(error.message).to.include("Item not listed for sale");
//       }
//     });

//     it("Should reject validation for incorrect payment amount", async function () {
//       // Approve and list
//       await nftContract
//         .connect(seller)
//         .setApprovalForAll(await marketplaceContract.getAddress(), true);
//       await marketplaceContract
//         .connect(seller)
//         .listItem(await nftContract.getAddress(), TOKEN_ID, LISTING_PRICE);

//       // Buy with incorrect amount
//       const incorrectPrice = LISTING_PRICE - ethers.parseEther("0.5");
//       try {
//         const buyTx = await marketplaceContract
//           .connect(buyer)
//           .buyItem(await nftContract.getAddress(), TOKEN_ID, {
//             value: incorrectPrice,
//           });
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
//       // Approve and list
//       await nftContract
//         .connect(seller)
//         .setApprovalForAll(await marketplaceContract.getAddress(), true);
//       await marketplaceContract
//         .connect(seller)
//         .listItem(await nftContract.getAddress(), TOKEN_ID, LISTING_PRICE);

//       // Buy successfully
//       const buyTx = await marketplaceContract
//         .connect(buyer)
//         .buyItem(await nftContract.getAddress(), TOKEN_ID, {
//           value: LISTING_PRICE,
//         });
//       const receipt = await buyTx.wait();
//       if (!receipt) return;

//       // Try to validate with wrong buyer
//       await expect(
//         validationService.validateBuyTransaction(
//           receipt.hash,
//           { address: await seller.getAddress() },
//           { address: await seller.getAddress() }, // Wrong buyer
//           { address: await seller.getAddress() },
//           await nftContract.getAddress(),
//           TOKEN_ID,
//           ethers.formatEther(LISTING_PRICE)
//         )
//       ).to.be.rejectedWith("Invalid buyer address");
//     });

//     it("Should reject validation for wrong seller", async function () {
//       // Approve and list
//       await nftContract
//         .connect(seller)
//         .setApprovalForAll(await marketplaceContract.getAddress(), true);
//       await marketplaceContract
//         .connect(seller)
//         .listItem(await nftContract.getAddress(), TOKEN_ID, LISTING_PRICE);

//       // Buy successfully
//       const buyTx = await marketplaceContract
//         .connect(buyer)
//         .buyItem(await nftContract.getAddress(), TOKEN_ID, {
//           value: LISTING_PRICE,
//         });
//       const receipt = await buyTx.wait();
//       if (!receipt) return;

//       // Try to validate with wrong seller
//       await expect(
//         validationService.validateBuyTransaction(
//           receipt.hash,
//           { address: await seller.getAddress() },
//           { address: await buyer.getAddress() },
//           { address: await buyer.getAddress() }, // Wrong seller
//           await nftContract.getAddress(),
//           TOKEN_ID,
//           ethers.formatEther(LISTING_PRICE)
//         )
//       ).to.be.rejectedWith("Invalid seller address");
//     });

//     it("Should validate multiple buys in sequence", async function () {
//       // Mint second token
//       const TOKEN_ID_2 = "2";
//       await nftContract
//         .connect(seller)
//         .mint(TOKEN_ID_2, TOKEN_URI, { value: MINT_FEE });

//       // Approve marketplace for both tokens
//       await nftContract
//         .connect(seller)
//         .setApprovalForAll(await marketplaceContract.getAddress(), true);

//       // List and buy first token
//       await marketplaceContract
//         .connect(seller)
//         .listItem(await nftContract.getAddress(), TOKEN_ID, LISTING_PRICE);
//       const buyTx1 = await marketplaceContract
//         .connect(buyer)
//         .buyItem(await nftContract.getAddress(), TOKEN_ID, {
//           value: LISTING_PRICE,
//         });
//       const receipt1 = await buyTx1.wait();

//       // List and buy second token
//       await marketplaceContract
//         .connect(seller)
//         .listItem(await nftContract.getAddress(), TOKEN_ID_2, LISTING_PRICE);
//       const buyTx2 = await marketplaceContract
//         .connect(buyer)
//         .buyItem(await nftContract.getAddress(), TOKEN_ID_2, {
//           value: LISTING_PRICE,
//         });
//       const receipt2 = await buyTx2.wait();

//       // Validate both transactions
//       const mockList = {
//         address: await seller.getAddress(),
//       };

//       if (!receipt1) return;
//       if (!receipt2) return;

//       const isValid1 = await validationService.validateBuyTransaction(
//         receipt1.hash,
//         mockList,
//         { address: await buyer.getAddress() },
//         { address: await seller.getAddress() },
//         await nftContract.getAddress(),
//         TOKEN_ID,
//         ethers.formatEther(LISTING_PRICE)
//       );

//       const isValid2 = await validationService.validateBuyTransaction(
//         receipt2.hash,
//         mockList,
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
