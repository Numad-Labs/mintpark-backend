import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { MPMNFT } from "../typechain-types";

describe("MPMNFT", function () {
  let nftContract: MPMNFT;
  let owner: Signer;
  let addr1: Signer;
  let addr2: Signer;
  const MINT_FEE = ethers.parseEther("0.1");
  const TOKEN_NAME = "Test NFT";
  const TOKEN_SYMBOL = "TNFT";

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const NFTFactory = await ethers.getContractFactory("MPMNFT");
    nftContract = (await NFTFactory.deploy(
      await owner.getAddress(), // Use getAddress() instead of .address
      TOKEN_NAME,
      TOKEN_SYMBOL,
      MINT_FEE
    )) as MPMNFT;
    await nftContract.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await nftContract.owner()).to.equal(await owner.getAddress());
    });

    it("Should set the correct name and symbol", async function () {
      expect(await nftContract.name()).to.equal(TOKEN_NAME);
      expect(await nftContract.symbol()).to.equal(TOKEN_SYMBOL);
    });

    it("Should set the correct mint fee", async function () {
      expect(await nftContract.mintFee()).to.equal(MINT_FEE);
    });
  });

  describe("Minting", function () {
    const tokenId = 1;
    const tokenURI = "ipfs://test-uri";

    it("Should allow users to mint with correct fee and URI", async function () {
      await expect(
        nftContract.connect(addr1).mint(tokenId, tokenURI, { value: MINT_FEE })
      )
        .to.emit(nftContract, "Transfer")
        .withArgs(ethers.ZeroAddress, await addr1.getAddress(), tokenId);

      // Verify token ownership and URI
      expect(await nftContract.ownerOf(tokenId)).to.equal(
        await addr1.getAddress()
      );
      expect(await nftContract.tokenURI(tokenId)).to.equal(tokenURI);
    });

    it("Should prevent minting with insufficient fee", async function () {
      const insufficientFee = MINT_FEE - ethers.parseEther("0.05");
      await expect(
        nftContract
          .connect(addr1)
          .mint(tokenId, tokenURI, { value: insufficientFee })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should prevent minting same token ID twice", async function () {
      await nftContract
        .connect(addr1)
        .mint(tokenId, tokenURI, { value: MINT_FEE });
      await expect(
        nftContract
          .connect(addr2)
          .mint(tokenId, "ipfs://different-uri", { value: MINT_FEE })
      ).to.be.revertedWith("Token already minted");
    });

    it("Should allow minting multiple tokens with different IDs", async function () {
      await nftContract
        .connect(addr1)
        .mint(1, "ipfs://uri-1", { value: MINT_FEE });
      await nftContract
        .connect(addr1)
        .mint(2, "ipfs://uri-2", { value: MINT_FEE });

      expect(await nftContract.ownerOf(1)).to.equal(await addr1.getAddress());
      expect(await nftContract.ownerOf(2)).to.equal(await addr1.getAddress());
      expect(await nftContract.tokenURI(1)).to.equal("ipfs://uri-1");
      expect(await nftContract.tokenURI(2)).to.equal("ipfs://uri-2");
    });
  });

  describe("SafeMinting", function () {
    const tokenId = 1;
    const tokenURI = "ipfs://test-uri";

    it("Should allow owner to safeMint", async function () {
      await expect(
        nftContract.safeMint(await addr1.getAddress(), tokenId, tokenURI)
      )
        .to.emit(nftContract, "Transfer")
        .withArgs(ethers.ZeroAddress, await addr1.getAddress(), tokenId);

      expect(await nftContract.ownerOf(tokenId)).to.equal(
        await addr1.getAddress()
      );
      expect(await nftContract.tokenURI(tokenId)).to.equal(tokenURI);
    });

    it("Should prevent non-owner from safeMinting", async function () {
      await expect(
        nftContract
          .connect(addr1)
          .safeMint(await addr2.getAddress(), tokenId, tokenURI)
      ).to.be.revertedWithCustomError(
        nftContract,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("Batch Minting", function () {
    const quantity = 3;
    const uris = [
      "ipfs://test-uri-1",
      "ipfs://test-uri-2",
      "ipfs://test-uri-3",
    ];

    it("Should allow owner to batch mint", async function () {
      await nftContract.batchMint(await addr1.getAddress(), quantity, uris);

      for (let i = 0; i < quantity; i++) {
        expect(await nftContract.ownerOf(i)).to.equal(await addr1.getAddress());
        expect(await nftContract.tokenURI(i)).to.equal(uris[i]);
      }
    });

    it("Should prevent batch minting with mismatched quantities", async function () {
      const wrongUris = ["ipfs://test-uri-1", "ipfs://test-uri-2"];
      await expect(
        nftContract.batchMint(await addr1.getAddress(), quantity, wrongUris)
      ).to.be.revertedWith("Mismatch between quantity and URIs");
    });

    it("Should prevent non-owner from batch minting", async function () {
      await expect(
        nftContract
          .connect(addr1)
          .batchMint(await addr2.getAddress(), quantity, uris)
      ).to.be.revertedWithCustomError(
        nftContract,
        "OwnableUnauthorizedAccount"
      );
    });

    it("Should handle sequential batch minting correctly", async function () {
      // First batch
      await nftContract.batchMint(
        await addr1.getAddress(),
        2,
        uris.slice(0, 2)
      );

      // Second batch
      await nftContract.batchMint(await addr2.getAddress(), 1, [uris[2]]);

      // Verify all mints
      expect(await nftContract.ownerOf(0)).to.equal(await addr1.getAddress());
      expect(await nftContract.ownerOf(1)).to.equal(await addr1.getAddress());
      expect(await nftContract.ownerOf(2)).to.equal(await addr2.getAddress());

      expect(await nftContract.tokenURI(0)).to.equal(uris[0]);
      expect(await nftContract.tokenURI(1)).to.equal(uris[1]);
      expect(await nftContract.tokenURI(2)).to.equal(uris[2]);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set mint fee", async function () {
      const newFee = ethers.parseEther("0.2");
      await nftContract.setMintFee(newFee);
      expect(await nftContract.mintFee()).to.equal(newFee);
    });

    it("Should prevent non-owner from setting mint fee", async function () {
      const newFee = ethers.parseEther("0.2");
      await expect(
        nftContract.connect(addr1).setMintFee(newFee)
      ).to.be.revertedWithCustomError(
        nftContract,
        "OwnableUnauthorizedAccount"
      );
    });

    it("Should allow owner to withdraw funds", async function () {
      const tokenURI = "ipfs://test-uri";
      // First, have someone mint an NFT to add funds to contract
      await nftContract.connect(addr1).mint(1, tokenURI,{ value: MINT_FEE });

      const initialBalance = await ethers.provider.getBalance(
        await owner.getAddress()
      );
      await nftContract.withdraw();
      const finalBalance = await ethers.provider.getBalance(
        await owner.getAddress()
      );

      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("Should prevent non-owner from withdrawing funds", async function () {
      await expect(
        nftContract.connect(addr1).withdraw()
      ).to.be.revertedWithCustomError(
        nftContract,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("Token URI Handling", function () {
    it("Should handle tokenURI correctly after minting", async function () {
      const tokenId = 1;
      const uri = "ipfs://test-uri";

      await nftContract.safeMint(await addr1.getAddress(), tokenId, uri);
      expect(await nftContract.tokenURI(tokenId)).to.equal(uri);
    });

    it("Should revert when querying URI for non-existent token", async function () {
      await expect(nftContract.tokenURI(99999))
        .to.be.revertedWithCustomError(nftContract, "ERC721NonexistentToken")
        .withArgs(99999);
    });
  });

  describe("Interface Support", function () {
    it("Should support ERC721 interface", async function () {
      expect(await nftContract.supportsInterface("0x80ac58cd")).to.be.true;
    });

    it("Should support ERC721Metadata interface", async function () {
      expect(await nftContract.supportsInterface("0x5b5e139f")).to.be.true;
    });
  });

  describe("Gas Usage", function () {
    it("Should track gas usage for minting", async function () {
      const tokenURI = "ipfs://test-uri";
      // First, have someone mint an NFT to add funds to contract

      const tx = await nftContract.connect(addr1).mint(1, tokenURI,{ value: MINT_FEE });

      const receipt = await tx.wait();
      console.log("Gas used for single mint:", receipt?.gasUsed.toString());
    });

    it("Should track gas usage for batch minting", async function () {
      const uris = ["uri1", "uri2", "uri3"];
      const tx = await nftContract.batchMint(await addr1.getAddress(), 3, uris);
      const receipt = await tx.wait();
      console.log("Gas used for batch mint:", receipt?.gasUsed.toString());
    });
  });
});
