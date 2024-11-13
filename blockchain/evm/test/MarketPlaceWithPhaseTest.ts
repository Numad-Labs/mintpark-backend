import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { MarketplaceWithPhase, MPMNFT } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MerkleTree } from "merkletreejs";
import { keccak256 } from "ethers";

describe("MarketplaceWithPhase", function () {
  let marketplace: MarketplaceWithPhase;
  let nftContract: MPMNFT;
  let owner: Signer;
  let seller: Signer;
  let buyer: Signer;
  let whitelistedBuyer: Signer;
  let addrs: Signer[];
  let merkleTree: MerkleTree;

  const TOKEN_ID = 1;
  const LISTING_PRICE = ethers.parseEther("1.0");
  const MINT_FEE = ethers.parseEther("0.1");
  const TOKEN_URI = "ipfs://test-uri";
  const MARKETPLACE_FEE = 250; // 2.5%
  const PUBLIC_MAX_MINT = 5;

  beforeEach(async function () {
    [owner, seller, buyer, whitelistedBuyer, ...addrs] =
      await ethers.getSigners();

    // Deploy contracts
    const NFTFactory = await ethers.getContractFactory("MPMNFT");
    nftContract = (await NFTFactory.deploy(
      await owner.getAddress(),
      "Test NFT",
      "TNFT",
      MINT_FEE
    )) as MPMNFT;
    await nftContract.waitForDeployment();

    const MarketplaceFactory = await ethers.getContractFactory(
      "MarketplaceWithPhase"
    );
    marketplace = (await MarketplaceFactory.deploy(
      await owner.getAddress(),
      MARKETPLACE_FEE
    )) as MarketplaceWithPhase;
    await marketplace.waitForDeployment();

    // Register collection with public phase
    await marketplace.registerCollection(
      await nftContract.getAddress(),
      PUBLIC_MAX_MINT
    );

    // Mint NFT to seller
    await nftContract
      .connect(seller)
      .mint(TOKEN_ID, TOKEN_URI, { value: MINT_FEE });
  });

  describe("Phase Configuration", function () {
    let whitelistEndTime: number;
    let fcfsEndTime: number;

    beforeEach(async function () {
      const currentTime = await time.latest();
      whitelistEndTime = currentTime + 3600; // 1 hour from now
      fcfsEndTime = whitelistEndTime + 3600; // 2 hours from now

      // Create merkle tree for whitelist
      const whitelistedAddresses = [await whitelistedBuyer.getAddress()];
      const leafNodes = whitelistedAddresses.map((addr) =>
        keccak256(ethers.toUtf8Bytes(addr))
      );
      merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
    });

    it("Should register collection with public phase only", async function () {
      const collection = await marketplace.getCollectionConfig(
        await nftContract.getAddress()
      );
      expect(collection.isActive).to.be.true;
      expect(collection.publicMaxMint).to.equal(PUBLIC_MAX_MINT);
      expect(collection.whitelistEndTime).to.equal(0);
      expect(collection.fcfsEndTime).to.equal(0);
    });

    it("Should configure optional phases correctly", async function () {
      const whitelistMax = 2;
      const fcfsMax = 3;

      await marketplace.configureOptionalPhases(
        await nftContract.getAddress(),
        whitelistEndTime,
        fcfsEndTime,
        whitelistMax,
        fcfsMax,
        merkleTree.getRoot()
      );

      const config = await marketplace.getCollectionConfig(
        await nftContract.getAddress()
      );
      expect(config.whitelistEndTime).to.equal(whitelistEndTime);
      expect(config.fcfsEndTime).to.equal(fcfsEndTime);
      expect(config.whitelistMaxMint).to.equal(whitelistMax);
      expect(config.fcfsMaxMint).to.equal(fcfsMax);
    });

    it("Should return correct current phase", async function () {
      await marketplace.configureOptionalPhases(
        await nftContract.getAddress(),
        whitelistEndTime,
        fcfsEndTime,
        2,
        3,
        merkleTree.getRoot()
      );

      // Check whitelist phase
      expect(
        await marketplace.getCurrentPhase(await nftContract.getAddress())
      ).to.equal(1);

      // Move to FCFS phase
      await time.increaseTo(whitelistEndTime + 1);
      expect(
        await marketplace.getCurrentPhase(await nftContract.getAddress())
      ).to.equal(2);

      // Move to public phase
      await time.increaseTo(fcfsEndTime + 1);
      expect(
        await marketplace.getCurrentPhase(await nftContract.getAddress())
      ).to.equal(3);
    });
  });

  describe("Phase-Based Purchasing", function () {
    let whitelistEndTime: number;
    let fcfsEndTime: number;
    let merkleProof: string[];
    let merkleRoot: string;

    beforeEach(async function () {
      const currentTime = await time.latest();
      whitelistEndTime = currentTime + 3600;
      fcfsEndTime = whitelistEndTime + 3600;

      // Setup whitelist with proper hashing
      const whitelistedAddress = await whitelistedBuyer.getAddress();
      const leafNode = keccak256(
        ethers.solidityPacked(["address"], [whitelistedAddress])
      );
      merkleTree = new MerkleTree([leafNode], keccak256, { sortPairs: true });
      merkleRoot = merkleTree.getHexRoot();
      merkleProof = merkleTree.getHexProof(leafNode);

      // Configure phases
      await marketplace.configureOptionalPhases(
        await nftContract.getAddress(),
        whitelistEndTime,
        fcfsEndTime,
        2, // whitelist max
        3, // fcfs max
        merkleTree.getRoot()
      );

      // Create listing
      await nftContract
        .connect(seller)
        .setApprovalForAll(await marketplace.getAddress(), true);
      await marketplace
        .connect(seller)
        .createListing(await nftContract.getAddress(), TOKEN_ID, LISTING_PRICE);
    });

    it("Should allow whitelisted buyer to purchase during whitelist phase", async function () {
      await marketplace
        .connect(whitelistedBuyer)
        .purchaseListing(1, merkleProof, {
          value: LISTING_PRICE,
        });

      expect(await nftContract.ownerOf(TOKEN_ID)).to.equal(
        await whitelistedBuyer.getAddress()
      );
    });

    it("Should not allow non-whitelisted buyer during whitelist phase", async function () {
      await expect(
        marketplace.connect(buyer).purchaseListing(1, [], {
          value: LISTING_PRICE,
        })
      ).to.be.revertedWith("Not whitelisted");
    });

    it("Should allow any buyer during FCFS phase", async function () {
      await time.increaseTo(whitelistEndTime + 1);

      await marketplace.connect(buyer).purchaseListing(1, [], {
        value: LISTING_PRICE,
      });

      expect(await nftContract.ownerOf(TOKEN_ID)).to.equal(
        await buyer.getAddress()
      );
    });

    it("Should enforce mint limits per phase", async function () {
      // Mint first token in whitelist phase
      const TOKEN_ID_2 = 2;
      await nftContract
        .connect(seller)
        .mint(TOKEN_ID_2, TOKEN_URI, { value: MINT_FEE });
      await marketplace
        .connect(seller)
        .createListing(
          await nftContract.getAddress(),
          TOKEN_ID_2,
          LISTING_PRICE
        );

      await marketplace
        .connect(whitelistedBuyer)
        .purchaseListing(1, merkleProof, {
          value: LISTING_PRICE,
        });
      await marketplace
        .connect(whitelistedBuyer)
        .purchaseListing(2, merkleProof, {
          value: LISTING_PRICE,
        });

      // Third attempt should fail due to whitelist limit
      const TOKEN_ID_3 = 3;
      await nftContract
        .connect(seller)
        .mint(TOKEN_ID_3, TOKEN_URI, { value: MINT_FEE });
      await marketplace
        .connect(seller)
        .createListing(
          await nftContract.getAddress(),
          TOKEN_ID_3,
          LISTING_PRICE
        );

      await expect(
        marketplace.connect(whitelistedBuyer).purchaseListing(3, merkleProof, {
          value: LISTING_PRICE,
        })
      ).to.be.revertedWith("Exceeds phase mint limit");
    });
  });

  // Include original test suites as well...
  // (Marketplace Setup, Listing Management, Purchase Functionality, Listing Cancellation)
});
