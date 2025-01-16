// import { expect } from "chai";
// import { ethers } from "hardhat";
// import { Signer } from "ethers";
// import { MarketplaceWithPhase, InscriptionNFT } from "../typechain-types";
// import { time } from "@nomicfoundation/hardhat-network-helpers";
// import { MerkleTree } from "merkletreejs";
// import { keccak256 } from "ethers";

// describe("MarketplaceWithPhase with InscriptionNFT", function () {
//   let marketplace: MarketplaceWithPhase;
//   let nftContract: InscriptionNFT;
//   let owner: Signer;
//   let minter: Signer;
//   let seller: Signer;
//   let buyer1: Signer;
//   let buyer2: Signer;
//   let whitelistedBuyer: Signer;
//   let addrs: Signer[];

//   // Constants
//   const TOKEN_ID = 1;
//   const INSCRIPTION_ID = "inscription123";
//   const MARKETPLACE_FEE = 250; // 2.5%
//   const LISTING_PRICE = ethers.parseEther("1.0");
//   const PUBLIC_MAX_MINT = 5;

//   // Constants for testing
//   const BASE_PRICE = ethers.parseEther("1.0");

//   async function createNFTAndListing(
//     tokenId: number,
//     price: bigint = BASE_PRICE
//   ) {
//     // Mint NFT
//     await nftContract
//       .connect(minter)
//       .mint(await seller.getAddress(), tokenId, `inscription_${tokenId}`);

//     // Create listing
//     await marketplace
//       .connect(seller)
//       .createListing(await nftContract.getAddress(), tokenId, price);
//   }

//   beforeEach(async function () {
//     [owner, minter, seller, buyer1, buyer2] = await ethers.getSigners();

//     await ethers.getSigners();

//     // Deploy NFT Contract
//     const NFTFactory = await ethers.getContractFactory("InscriptionNFT");
//     nftContract = (await NFTFactory.connect(owner).deploy(
//       await minter.getAddress(),
//       await owner.getAddress(),
//       "Test Inscription NFT"
//     )) as InscriptionNFT;
//     await nftContract.waitForDeployment();

//     // Deploy Marketplace
//     const MarketplaceFactory = await ethers.getContractFactory(
//       "MarketplaceWithPhase"
//     );
//     marketplace = (await MarketplaceFactory.connect(owner).deploy(
//       await owner.getAddress(),
//       MARKETPLACE_FEE
//     )) as MarketplaceWithPhase;
//     await marketplace.waitForDeployment();

//     // Register collection
//     await marketplace.registerCollection(
//       await nftContract.getAddress(),
//       PUBLIC_MAX_MINT
//     );

//     // Approve marketplace for all tokens
//     await nftContract
//       .connect(seller)
//       .setApprovalForAll(await marketplace.getAddress(), true);

//     // Mint initial NFT
//     await nftContract
//       .connect(minter)
//       .mint(await seller.getAddress(), TOKEN_ID, INSCRIPTION_ID);

//     // Log initial setup state
//     console.log("\nTest Setup:");
//     console.log("NFT Contract:", await nftContract.getAddress());
//     console.log("Marketplace:", await marketplace.getAddress());
//     console.log("Seller:", await seller.getAddress());
//     console.log("Buyer1:", await buyer1.getAddress());
//     console.log("Buyer2:", await buyer2.getAddress());
//   });

//   describe("Basic Functionality", function () {
//     it("Should verify inscription ID after minting", async function () {
//       const currentOwner = await nftContract.ownerOf(TOKEN_ID);
//       expect(currentOwner).to.equal(await seller.getAddress());

//       const inscriptionId = await nftContract.getInscriptionId(TOKEN_ID);
//       expect(inscriptionId).to.equal(INSCRIPTION_ID);
//     });

//     it("Should create and execute listing with inscription NFT", async function () {
//       // Approve marketplace
//       await nftContract
//         .connect(seller)
//         .setApprovalForAll(await marketplace.getAddress(), true);

//       // Create listing
//       await marketplace
//         .connect(seller)
//         .createListing(await nftContract.getAddress(), TOKEN_ID, LISTING_PRICE);

//       // Purchase listing
//       await marketplace.connect(buyer1).purchaseListing(1, [], {
//         value: LISTING_PRICE,
//       });

//       expect(await nftContract.ownerOf(TOKEN_ID)).to.equal(
//         await buyer1.getAddress()
//       );
//       expect(await nftContract.getInscriptionId(TOKEN_ID)).to.equal(
//         INSCRIPTION_ID
//       );
//     });
//   });

//   describe("Phase Configuration", function () {
//     let whitelistEndTime: number;
//     let fcfsEndTime: number;
//     let merkleTree: MerkleTree;

//     beforeEach(async function () {
//       const currentTime = await time.latest();
//       whitelistEndTime = currentTime + 3600; // 1 hour from now
//       fcfsEndTime = whitelistEndTime + 3600; // 2 hours from now

//       // Create merkle tree
//       const whitelistedAddress = await whitelistedBuyer.getAddress();
//       const leafNode = keccak256(
//         ethers.solidityPacked(["address"], [whitelistedAddress])
//       );
//       merkleTree = new MerkleTree([leafNode], keccak256, { sortPairs: true });

//       // Mint additional NFT for whitelist test
//       const WHITELIST_TOKEN_ID = 2;
//       await nftContract
//         .connect(minter)
//         .mint(await seller.getAddress(), WHITELIST_TOKEN_ID, "inscription_wl");
//     });

//     it("Should handle whitelist phase with inscription NFTs", async function () {
//       // Configure phases
//       await marketplace.configureOptionalPhases(
//         await nftContract.getAddress(),
//         whitelistEndTime,
//         fcfsEndTime,
//         2, // whitelist max
//         3, // fcfs max
//         merkleTree.getHexRoot()
//       );

//       // Approve marketplace
//       await nftContract
//         .connect(seller)
//         .setApprovalForAll(await marketplace.getAddress(), true);

//       // Create listing
//       await marketplace.connect(seller).createListing(
//         await nftContract.getAddress(),
//         2, // Use WHITELIST_TOKEN_ID
//         LISTING_PRICE
//       );

//       // Get merkle proof
//       const whitelistedAddress = await whitelistedBuyer.getAddress();
//       const leafNode = keccak256(
//         ethers.solidityPacked(["address"], [whitelistedAddress])
//       );
//       const merkleProof = merkleTree.getHexProof(leafNode);

//       // Purchase during whitelist phase
//       await marketplace
//         .connect(whitelistedBuyer)
//         .purchaseListing(1, merkleProof, {
//           value: LISTING_PRICE,
//         });

//       expect(await nftContract.ownerOf(2)).to.equal(
//         await whitelistedBuyer.getAddress()
//       );
//     });
//   });

//   it("Should transfer the correct token when listings are purchased in order", async function () {
//     // Create two listings with different token IDs
//     await createNFTAndListing(150);
//     await createNFTAndListing(250);

//     // Purchase first listing
//     await marketplace.connect(buyer1).purchaseListing(1, [], {
//       value: BASE_PRICE,
//     });

//     // Purchase second listing
//     await marketplace.connect(buyer2).purchaseListing(2, [], {
//       value: BASE_PRICE,
//     });

//     // Verify correct tokens were transferred
//     expect(await nftContract.ownerOf(150)).to.equal(await buyer1.getAddress());
//     expect(await nftContract.ownerOf(250)).to.equal(await buyer2.getAddress());
//   });

//   it("Should transfer the correct token when listings are purchased out of order", async function () {
//     // Create three listings with different token IDs
//     await createNFTAndListing(300);
//     await createNFTAndListing(400);
//     await createNFTAndListing(500);

//     // Purchase listings in reverse order
//     await marketplace.connect(buyer1).purchaseListing(3, [], {
//       value: BASE_PRICE,
//     });
//     await marketplace.connect(buyer2).purchaseListing(1, [], {
//       value: BASE_PRICE,
//     });
//     await marketplace.connect(buyer1).purchaseListing(2, [], {
//       value: BASE_PRICE,
//     });

//     // Verify correct tokens were transferred
//     expect(await nftContract.ownerOf(300)).to.equal(await buyer2.getAddress());
//     expect(await nftContract.ownerOf(400)).to.equal(await buyer1.getAddress());
//     expect(await nftContract.ownerOf(500)).to.equal(await buyer1.getAddress());
//   });

//   it("Should handle relisting and purchasing of the same token", async function () {
//     // Create initial listing for token ID 600
//     await createNFTAndListing(600);

//     // Cancel the listing
//     await marketplace.connect(seller).cancelListing(1);

//     // Create new listing for the same token
//     await marketplace
//       .connect(seller)
//       .createListing(await nftContract.getAddress(), 600, BASE_PRICE);

//     // Purchase the new listing
//     await marketplace.connect(buyer1).purchaseListing(2, [], {
//       value: BASE_PRICE,
//     });

//     // Verify the correct token was transferred
//     expect(await nftContract.ownerOf(600)).to.equal(await buyer1.getAddress());
//   });

//   it("Should handle listings with the same token ID as listing ID", async function () {
//     console.log("\nTesting listings with matching token and listing IDs:");

//     // Create first listing
//     await createNFTAndListing(1);
//     console.log("Created listing 1 with token ID 1");

//     // Verify first token ownership
//     const owner1 = await nftContract.ownerOf(1);
//     console.log("Token 1 owner:", owner1);
//     expect(owner1).to.equal(await seller.getAddress());

//     // Create second listing
//     await createNFTAndListing(2);
//     console.log("Created listing 2 with token ID 2");

//     // Verify second token ownership
//     const owner2 = await nftContract.ownerOf(2);
//     console.log("Token 2 owner:", owner2);
//     expect(owner2).to.equal(await seller.getAddress());

//     // Purchase first listing
//     await marketplace.connect(buyer1).purchaseListing(1, [], {
//       value: BASE_PRICE,
//     });
//     console.log("Buyer1 purchased listing 1");

//     // Purchase second listing
//     await marketplace.connect(buyer2).purchaseListing(2, [], {
//       value: BASE_PRICE,
//     });
//     console.log("Buyer2 purchased listing 2");

//     // Final ownership verification
//     expect(await nftContract.ownerOf(1)).to.equal(await buyer1.getAddress());
//     expect(await nftContract.ownerOf(2)).to.equal(await buyer2.getAddress());
//   });

//   it("Should handle multiple listings with same token ID after transfers", async function () {
//     // Create and purchase first listing for token ID 700
//     await createNFTAndListing(700);
//     await marketplace.connect(buyer1).purchaseListing(1, [], {
//       value: BASE_PRICE,
//     });

//     // Buyer1 approves marketplace and creates new listing
//     await nftContract
//       .connect(buyer1)
//       .setApprovalForAll(await marketplace.getAddress(), true);
//     await marketplace
//       .connect(buyer1)
//       .createListing(
//         await nftContract.getAddress(),
//         700,
//         BASE_PRICE * BigInt(2)
//       );

//     // Buyer2 purchases the token
//     await marketplace.connect(buyer2).purchaseListing(2, [], {
//       value: BASE_PRICE * BigInt(2),
//     });

//     // Verify final ownership
//     expect(await nftContract.ownerOf(700)).to.equal(await buyer2.getAddress());
//   });

//   it("Should fail if trying to purchase with incorrect listing ID", async function () {
//     // Create listing for token ID 800
//     await createNFTAndListing(800);

//     // Attempt to purchase with non-existent listing ID
//     await expect(
//       marketplace.connect(buyer1).purchaseListing(999, [], {
//         value: BASE_PRICE,
//       })
//     ).to.be.revertedWith("Listing not active");
//   });

//   it("Should validate listing data matches token data", async function () {
//     // Create listing for token ID 900
//     await createNFTAndListing(900);

//     const listingId = await marketplace.getListingIdCounter();
//     const listing = await marketplace.getListing(listingId);

//     // Verify listing data
//     expect(listing.tokenId).to.equal(BigInt(900));
//     expect(listing.seller).to.equal(await seller.getAddress());
//     expect(listing.nftContract).to.equal(await nftContract.getAddress());
//     expect(listing.price).to.equal(BASE_PRICE);
//     expect(listing.isActive).to.equal(true);

//     // Verify original ownership
//     expect(await nftContract.ownerOf(900)).to.equal(await seller.getAddress());

//     // Purchase and verify transfer
//     await marketplace.connect(buyer1).purchaseListing(listingId, [], {
//       value: BASE_PRICE,
//     });

//     expect(await nftContract.ownerOf(900)).to.equal(await buyer1.getAddress());
//   });
// });

// //   describe("Listing ID vs Token ID Transfer Tests", function () {
// //     beforeEach(async function () {
// //       // Mint additional tokens for testing
// //       await nftContract
// //         .connect(minter)
// //         .mint(await seller.getAddress(), 2, "inscription2");
// //       await nftContract
// //         .connect(minter)
// //         .mint(await seller.getAddress(), 3, "inscription3");

// //       // Approve marketplace for all tokens
// //       await nftContract
// //         .connect(seller)
// //         .setApprovalForAll(await marketplace.getAddress(), true);
// //     });

// //     it("Should transfer correct token ID regardless of listing ID", async function () {
// //       const tx = await marketplace.connect(seller).createListing(
// //         await nftContract.getAddress(),
// //         2, // Using token ID 2
// //         LISTING_PRICE
// //       );
// //       const receipt = await tx.wait();
// //       const listingId = receipt?.logs.find(
// //         (log) => log.fragment?.name === "ListingCreated"
// //       )?.args?.listingId;

// //       await marketplace.connect(buyer).purchaseListing(listingId, [], {
// //         value: LISTING_PRICE,
// //       });

// //       expect(await nftContract.ownerOf(2)).to.equal(await buyer.getAddress());
// //       expect(await nftContract.ownerOf(TOKEN_ID)).to.equal(
// //         await seller.getAddress()
// //       );
// //     });

// //     it("Should track listing counts separately from token IDs", async function () {
// //       const listingCountBefore = await marketplace.getListingIdCounter();

// //       // Create listings for different tokens
// //       await marketplace
// //         .connect(seller)
// //         .createListing(await nftContract.getAddress(), 1, LISTING_PRICE);
// //       await marketplace
// //         .connect(seller)
// //         .createListing(await nftContract.getAddress(), 2, LISTING_PRICE);
// //       await marketplace
// //         .connect(seller)
// //         .createListing(await nftContract.getAddress(), 3, LISTING_PRICE);

// //       const listingCountAfter = await marketplace.getListingIdCounter();
// //       expect(listingCountAfter).to.equal(listingCountBefore + 3n);
// //     });
// //   });
// // });
