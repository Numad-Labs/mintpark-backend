import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { MPMNFT, MarketplaceContract } from "../typechain-types";

// describe("MPMNFT", function () {
//   let nftContract: MPMNFT;
//   let owner: Signer;
//   let addr1: Signer;
//   let addr2: Signer;
//   const MINT_FEE = ethers.parseEther("0.1");
//   const TOKEN_NAME = "Test NFT";
//   const TOKEN_SYMBOL = "TNFT";

//   beforeEach(async function () {
//     [owner, addr1, addr2] = await ethers.getSigners();

//     const NFTFactory = await ethers.getContractFactory("MPMNFT");
//     nftContract = (await NFTFactory.deploy(
//       await owner.getAddress(), // Use getAddress() instead of .address
//       TOKEN_NAME,
//       TOKEN_SYMBOL,
//       MINT_FEE
//     )) as MPMNFT;
//     await nftContract.waitForDeployment();
//   });

//   describe("Deployment", function () {
//     it("Should set the right owner", async function () {
//       expect(await nftContract.owner()).to.equal(await owner.getAddress());
//     });

//     it("Should set the correct name and symbol", async function () {
//       expect(await nftContract.name()).to.equal(TOKEN_NAME);
//       expect(await nftContract.symbol()).to.equal(TOKEN_SYMBOL);
//     });

//     it("Should set the correct mint fee", async function () {
//       expect(await nftContract.mintFee()).to.equal(MINT_FEE);
//     });
//   });

//   describe("Minting", function () {
//     const tokenId = 1;
//     const tokenURI = "ipfs://test-uri";

//     it("Should allow users to mint with correct fee and URI", async function () {
//       await expect(
//         nftContract.connect(addr1).mint(tokenId, tokenURI, { value: MINT_FEE })
//       )
//         .to.emit(nftContract, "Transfer")
//         .withArgs(ethers.ZeroAddress, await addr1.getAddress(), tokenId);

//       // Verify token ownership and URI
//       expect(await nftContract.ownerOf(tokenId)).to.equal(
//         await addr1.getAddress()
//       );
//       expect(await nftContract.tokenURI(tokenId)).to.equal(tokenURI);
//     });

//     it("Should prevent minting with insufficient fee", async function () {
//       const insufficientFee = MINT_FEE - ethers.parseEther("0.05");
//       await expect(
//         nftContract
//           .connect(addr1)
//           .mint(tokenId, tokenURI, { value: insufficientFee })
//       ).to.be.revertedWith("Insufficient payment");
//     });

//     it("Should prevent minting same token ID twice", async function () {
//       await nftContract
//         .connect(addr1)
//         .mint(tokenId, tokenURI, { value: MINT_FEE });
//       await expect(
//         nftContract
//           .connect(addr2)
//           .mint(tokenId, "ipfs://different-uri", { value: MINT_FEE })
//       ).to.be.revertedWith("Token already minted");
//     });

//     it("Should allow minting multiple tokens with different IDs", async function () {
//       await nftContract
//         .connect(addr1)
//         .mint(1, "ipfs://uri-1", { value: MINT_FEE });
//       await nftContract
//         .connect(addr1)
//         .mint(2, "ipfs://uri-2", { value: MINT_FEE });

//       expect(await nftContract.ownerOf(1)).to.equal(await addr1.getAddress());
//       expect(await nftContract.ownerOf(2)).to.equal(await addr1.getAddress());
//       expect(await nftContract.tokenURI(1)).to.equal("ipfs://uri-1");
//       expect(await nftContract.tokenURI(2)).to.equal("ipfs://uri-2");
//     });
//   });

//   describe("SafeMinting", function () {
//     const tokenId = 1;
//     const tokenURI = "ipfs://test-uri";

//     it("Should allow owner to safeMint", async function () {
//       await expect(
//         nftContract.safeMint(await addr1.getAddress(), tokenId, tokenURI)
//       )
//         .to.emit(nftContract, "Transfer")
//         .withArgs(ethers.ZeroAddress, await addr1.getAddress(), tokenId);

//       expect(await nftContract.ownerOf(tokenId)).to.equal(
//         await addr1.getAddress()
//       );
//       expect(await nftContract.tokenURI(tokenId)).to.equal(tokenURI);
//     });

//     it("Should prevent non-owner from safeMinting", async function () {
//       await expect(
//         nftContract
//           .connect(addr1)
//           .safeMint(await addr2.getAddress(), tokenId, tokenURI)
//       ).to.be.revertedWithCustomError(
//         nftContract,
//         "OwnableUnauthorizedAccount"
//       );
//     });
//   });

//   describe("Batch Minting", function () {
//     const quantity = 3;
//     const uris = [
//       "ipfs://test-uri-1",
//       "ipfs://test-uri-2",
//       "ipfs://test-uri-3",
//     ];

//     it("Should allow owner to batch mint", async function () {
//       await nftContract.batchMint(await addr1.getAddress(), quantity, uris);

//       for (let i = 0; i < quantity; i++) {
//         expect(await nftContract.ownerOf(i)).to.equal(await addr1.getAddress());
//         expect(await nftContract.tokenURI(i)).to.equal(uris[i]);
//       }
//     });

//     it("Should prevent batch minting with mismatched quantities", async function () {
//       const wrongUris = ["ipfs://test-uri-1", "ipfs://test-uri-2"];
//       await expect(
//         nftContract.batchMint(await addr1.getAddress(), quantity, wrongUris)
//       ).to.be.revertedWith("Mismatch between quantity and URIs");
//     });

//     it("Should prevent non-owner from batch minting", async function () {
//       await expect(
//         nftContract
//           .connect(addr1)
//           .batchMint(await addr2.getAddress(), quantity, uris)
//       ).to.be.revertedWithCustomError(
//         nftContract,
//         "OwnableUnauthorizedAccount"
//       );
//     });

//     it("Should handle sequential batch minting correctly", async function () {
//       // First batch
//       await nftContract.batchMint(
//         await addr1.getAddress(),
//         2,
//         uris.slice(0, 2)
//       );

//       // Second batch
//       await nftContract.batchMint(await addr2.getAddress(), 1, [uris[2]]);

//       // Verify all mints
//       expect(await nftContract.ownerOf(0)).to.equal(await addr1.getAddress());
//       expect(await nftContract.ownerOf(1)).to.equal(await addr1.getAddress());
//       expect(await nftContract.ownerOf(2)).to.equal(await addr2.getAddress());

//       expect(await nftContract.tokenURI(0)).to.equal(uris[0]);
//       expect(await nftContract.tokenURI(1)).to.equal(uris[1]);
//       expect(await nftContract.tokenURI(2)).to.equal(uris[2]);
//     });
//   });

//   describe("Admin Functions", function () {
//     it("Should allow owner to set mint fee", async function () {
//       const newFee = ethers.parseEther("0.2");
//       await nftContract.setMintFee(newFee);
//       expect(await nftContract.mintFee()).to.equal(newFee);
//     });

//     it("Should prevent non-owner from setting mint fee", async function () {
//       const newFee = ethers.parseEther("0.2");
//       await expect(
//         nftContract.connect(addr1).setMintFee(newFee)
//       ).to.be.revertedWithCustomError(
//         nftContract,
//         "OwnableUnauthorizedAccount"
//       );
//     });

//     it("Should allow owner to withdraw funds", async function () {
//       const tokenURI = "ipfs://test-uri";
//       // First, have someone mint an NFT to add funds to contract
//       await nftContract.connect(addr1).mint(1, tokenURI, { value: MINT_FEE });

//       const initialBalance = await ethers.provider.getBalance(
//         await owner.getAddress()
//       );
//       await nftContract.withdraw();
//       const finalBalance = await ethers.provider.getBalance(
//         await owner.getAddress()
//       );

//       expect(finalBalance).to.be.gt(initialBalance);
//     });

//     it("Should prevent non-owner from withdrawing funds", async function () {
//       await expect(
//         nftContract.connect(addr1).withdraw()
//       ).to.be.revertedWithCustomError(
//         nftContract,
//         "OwnableUnauthorizedAccount"
//       );
//     });
//   });

//   describe("Token URI Handling", function () {
//     it("Should handle tokenURI correctly after minting", async function () {
//       const tokenId = 1;
//       const uri = "ipfs://test-uri";

//       await nftContract.safeMint(await addr1.getAddress(), tokenId, uri);
//       expect(await nftContract.tokenURI(tokenId)).to.equal(uri);
//     });

//     it("Should revert when querying URI for non-existent token", async function () {
//       await expect(nftContract.tokenURI(99999))
//         .to.be.revertedWithCustomError(nftContract, "ERC721NonexistentToken")
//         .withArgs(99999);
//     });
//   });

//   describe("Interface Support", function () {
//     it("Should support ERC721 interface", async function () {
//       expect(await nftContract.supportsInterface("0x80ac58cd")).to.be.true;
//     });

//     it("Should support ERC721Metadata interface", async function () {
//       expect(await nftContract.supportsInterface("0x5b5e139f")).to.be.true;
//     });
//   });

//   describe("Gas Usage", function () {
//     it("Should track gas usage for minting", async function () {
//       const tokenURI = "ipfs://test-uri";
//       // First, have someone mint an NFT to add funds to contract

//       const tx = await nftContract
//         .connect(addr1)
//         .mint(1, tokenURI, { value: MINT_FEE });

//       const receipt = await tx.wait();
//       console.log("Gas used for single mint:", receipt?.gasUsed.toString());
//     });

//     it("Should track gas usage for batch minting", async function () {
//       const uris = ["uri1", "uri2", "uri3"];
//       const tx = await nftContract.batchMint(await addr1.getAddress(), 3, uris);
//       const receipt = await tx.wait();
//       console.log("Gas used for batch mint:", receipt?.gasUsed.toString());
//     });
//   });
// });

// describe("MarketplaceContract", function () {
//   let marketplace: MarketplaceContract;
//   let nftContract: MPMNFT;
//   let owner: Signer;
//   let seller: Signer;
//   let buyer: Signer;
//   let addrs: Signer[];

//   const TOKEN_ID = 1;
//   const LISTING_PRICE = ethers.parseEther("1.0");
//   const MINT_FEE = ethers.parseEther("0.1");
//   const TOKEN_URI = "ipfs://test-uri";

//   beforeEach(async function () {
//     [owner, seller, buyer, ...addrs] = await ethers.getSigners();

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
//     marketplace = (await MarketplaceFactory.deploy()) as MarketplaceContract;
//     await marketplace.waitForDeployment();

//     // Mint NFT to seller
//     await nftContract
//       .connect(seller)
//       .mint(TOKEN_ID, TOKEN_URI, { value: MINT_FEE });
//   });

//   describe("Deployment", function () {
//     it("Should set the right owner", async function () {
//       expect(await marketplace.owner()).to.equal(await owner.getAddress());
//     });
//   });

//   describe("Listing", function () {
//     beforeEach(async function () {
//       // Approve marketplace for NFT transfer
//       await nftContract
//         .connect(seller)
//         .setApprovalForAll(await marketplace.getAddress(), true);
//     });

//     it("Should create a listing successfully", async function () {
//       await expect(
//         marketplace
//           .connect(seller)
//           .listItem(await nftContract.getAddress(), TOKEN_ID, LISTING_PRICE)
//       )
//         .to.emit(marketplace, "ItemListed")
//         .withArgs(
//           await seller.getAddress(),
//           await nftContract.getAddress(),
//           TOKEN_ID,
//           LISTING_PRICE
//         );

//       const listing = await marketplace.listings(
//         await nftContract.getAddress(),
//         TOKEN_ID
//       );
//       expect(listing.seller).to.equal(await seller.getAddress());
//       expect(listing.price).to.equal(LISTING_PRICE);
//       expect(listing.isActive).to.be.true;
//     });

//     it("Should not allow listing with zero price", async function () {
//       await expect(
//         marketplace
//           .connect(seller)
//           .listItem(await nftContract.getAddress(), TOKEN_ID, 0)
//       ).to.be.revertedWith("Price must be greater than zero");
//     });

//     it("Should not allow listing if not owner of NFT", async function () {
//       await expect(
//         marketplace
//           .connect(buyer)
//           .listItem(await nftContract.getAddress(), TOKEN_ID, LISTING_PRICE)
//       ).to.be.revertedWith("Not the owner of this NFT");
//     });

//     it("Should not allow listing without marketplace approval", async function () {
//       // Revoke approval
//       await nftContract
//         .connect(seller)
//         .setApprovalForAll(await marketplace.getAddress(), false);

//       await expect(
//         marketplace
//           .connect(seller)
//           .listItem(await nftContract.getAddress(), TOKEN_ID, LISTING_PRICE)
//       ).to.be.revertedWith("NFT not approved for marketplace");
//     });
//   });

//   describe("Buying", function () {
//     beforeEach(async function () {
//       await nftContract
//         .connect(seller)
//         .setApprovalForAll(await marketplace.getAddress(), true);
//       await marketplace
//         .connect(seller)
//         .listItem(await nftContract.getAddress(), TOKEN_ID, LISTING_PRICE);
//     });

//     it("Should allow buying a listed item", async function () {
//       await expect(
//         marketplace
//           .connect(buyer)
//           .buyItem(await nftContract.getAddress(), TOKEN_ID, {
//             value: LISTING_PRICE,
//           })
//       )
//         .to.emit(marketplace, "ItemSold")
//         .withArgs(
//           await seller.getAddress(),
//           await buyer.getAddress(),
//           await nftContract.getAddress(),
//           TOKEN_ID,
//           LISTING_PRICE
//         );

//       // Verify NFT ownership changed
//       expect(await nftContract.ownerOf(TOKEN_ID)).to.equal(
//         await buyer.getAddress()
//       );

//       // Verify listing is removed
//       const listing = await marketplace.listings(
//         await nftContract.getAddress(),
//         TOKEN_ID
//       );
//       expect(listing.isActive).to.be.false;
//     });

//     it("Should not allow buying with insufficient payment", async function () {
//       const insufficientPrice = LISTING_PRICE - ethers.parseEther("0.5");
//       await expect(
//         marketplace
//           .connect(buyer)
//           .buyItem(await nftContract.getAddress(), TOKEN_ID, {
//             value: insufficientPrice,
//           })
//       ).to.be.revertedWith("Insufficient payment");
//     });

//     it("Should not allow buying unlisted items", async function () {
//       const UNLISTED_TOKEN_ID = 2;
//       await nftContract
//         .connect(seller)
//         .mint(UNLISTED_TOKEN_ID, TOKEN_URI, { value: MINT_FEE });

//       await expect(
//         marketplace
//           .connect(buyer)
//           .buyItem(await nftContract.getAddress(), UNLISTED_TOKEN_ID, {
//             value: LISTING_PRICE,
//           })
//       ).to.be.revertedWith("Item not listed for sale");
//     });

//     it("Should transfer payment to seller", async function () {
//       const sellerInitialBalance = await ethers.provider.getBalance(
//         await seller.getAddress()
//       );

//       await marketplace
//         .connect(buyer)
//         .buyItem(await nftContract.getAddress(), TOKEN_ID, {
//           value: LISTING_PRICE,
//         });

//       const sellerFinalBalance = await ethers.provider.getBalance(
//         await seller.getAddress()
//       );
//       expect(sellerFinalBalance).to.be.gt(sellerInitialBalance);
//     });
//   });

//   describe("Cancelling Listings", function () {
//     beforeEach(async function () {
//       await nftContract
//         .connect(seller)
//         .setApprovalForAll(await marketplace.getAddress(), true);
//       await marketplace
//         .connect(seller)
//         .listItem(await nftContract.getAddress(), TOKEN_ID, LISTING_PRICE);
//     });

//     it("Should allow seller to cancel listing", async function () {
//       await expect(
//         marketplace
//           .connect(seller)
//           .cancelListing(await nftContract.getAddress(), TOKEN_ID)
//       )
//         .to.emit(marketplace, "ListingCancelled")
//         .withArgs(
//           await seller.getAddress(),
//           await nftContract.getAddress(),
//           TOKEN_ID
//         );

//       const listing = await marketplace.listings(
//         await nftContract.getAddress(),
//         TOKEN_ID
//       );
//       expect(listing.isActive).to.be.false;
//     });

//     it("Should not allow non-seller to cancel listing", async function () {
//       await expect(
//         marketplace
//           .connect(buyer)
//           .cancelListing(await nftContract.getAddress(), TOKEN_ID)
//       ).to.be.revertedWith("Not the seller");
//     });
//   });

//   describe("Listing Queries", function () {
//     it("Should return correct listing data", async function () {
//       await nftContract
//         .connect(seller)
//         .setApprovalForAll(await marketplace.getAddress(), true);
//       await marketplace
//         .connect(seller)
//         .listItem(await nftContract.getAddress(), TOKEN_ID, LISTING_PRICE);

//       const listing = await marketplace.getListing(
//         await nftContract.getAddress(),
//         TOKEN_ID
//       );
//       expect(listing.seller).to.equal(await seller.getAddress());
//       expect(listing.nftContract).to.equal(await nftContract.getAddress());
//       expect(listing.tokenId).to.equal(TOKEN_ID);
//       expect(listing.price).to.equal(LISTING_PRICE);
//       expect(listing.isActive).to.be.true;
//     });
//   });

//   describe("Gas Usage", function () {
//     beforeEach(async function () {
//       await nftContract
//         .connect(seller)
//         .setApprovalForAll(await marketplace.getAddress(), true);
//     });

//     it("Should track gas usage for listing", async function () {
//       const tx = await marketplace
//         .connect(seller)
//         .listItem(await nftContract.getAddress(), TOKEN_ID, LISTING_PRICE);
//       const receipt = await tx.wait();
//       console.log("Gas used for listing:", receipt?.gasUsed.toString());
//     });

//     it("Should track gas usage for buying", async function () {
//       await marketplace
//         .connect(seller)
//         .listItem(await nftContract.getAddress(), TOKEN_ID, LISTING_PRICE);

//       const tx = await marketplace
//         .connect(buyer)
//         .buyItem(await nftContract.getAddress(), TOKEN_ID, {
//           value: LISTING_PRICE,
//         });
//       const receipt = await tx.wait();
//       console.log("Gas used for buying:", receipt?.gasUsed.toString());
//     });
//   });
// });
