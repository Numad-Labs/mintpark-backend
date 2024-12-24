import { expect } from "chai";
import { ethers } from "hardhat";
import { InscriptionNFT } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Signer } from "ethers";
describe("InscriptionNFT", function () {
  let nftContract: InscriptionNFT;
  let owner: Signer;
  let minter: Signer;
  let user: Signer;
  let otherAccount: Signer;

  beforeEach(async function () {
    [owner, minter, user, otherAccount] = await ethers.getSigners();

    const InscriptionNFTFactory = await ethers.getContractFactory(
      "InscriptionNFT"
    );
    nftContract = (await InscriptionNFTFactory.deploy(
      await minter.getAddress(),
      await owner.getAddress(),
      "Test Inscription NFT"
    )) as InscriptionNFT;
    await nftContract.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await nftContract.owner()).to.equal(await owner.getAddress());
    });

    it("Should set the correct minter", async function () {
      expect(await nftContract.minterAddress()).to.equal(
        await minter.getAddress()
      );
    });
  });

  describe("Minting", function () {
    const testInscriptionId = "inscription123";

    it("Should allow minter to mint NFT", async function () {
      const tokenId = 1;
      const inscriptionId = "inscription123";

      // Make sure we're using the minter account
      const tx = await nftContract
        .connect(minter)
        .mint(await user.getAddress(), tokenId, inscriptionId);
      await tx.wait();

      expect(await nftContract.ownerOf(tokenId)).to.equal(
        await user.getAddress()
      );
      expect(await nftContract.getInscriptionId(tokenId)).to.equal(
        inscriptionId
      );
    });

    it("Should not allow non-minter to mint", async function () {
      const tokenId = 1;
      const inscriptionId = "inscription123";

      await expect(
        nftContract
          .connect(otherAccount)
          .mint(await user.getAddress(), tokenId, inscriptionId)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should not allow minting with empty inscription ID", async function () {
      const tokenId = 1;
      const emptyInscriptionId = "";

      await expect(
        nftContract
          .connect(minter)
          .mint(await user.getAddress(), tokenId, emptyInscriptionId)
      ).to.be.revertedWith("Invalid inscription ID");
    });
    it("Should mint sequential token IDs", async function () {
      // Mint first token
      await nftContract
        .connect(minter)
        .mint(await user.getAddress(), 1, "inscription1");
      expect(await nftContract.ownerOf(1)).to.equal(await user.getAddress());

      // Mint second token
      await nftContract
        .connect(minter)
        .mint(await user.getAddress(), 2, "inscription2");
      expect(await nftContract.ownerOf(2)).to.equal(await user.getAddress());
    });
  });

  // describe("Inscription ID Retrieval", function () {
  //   it("Should fail to get inscription ID for non-existent token", async function () {
  //     await expect(inscriptionNFT.getInscriptionId(1)).to.be.revertedWith(
  //       "Token does not exist"
  //     );
  //   });
  // });

  // describe("Minter Management", function () {
  //   it("Should allow owner to change minter", async function () {
  //     await inscriptionNFT.connect(owner).setMinter(other.address);
  //     expect(await inscriptionNFT.minterAddress()).to.equal(other.address);
  //   });
  //   it("Should not allow non-owner to change minter", async function () {
  //     await expect(inscriptionNFT.connect(other).setMinter(other.address))
  //       .to.be.revertedWithCustomError(
  //         inscriptionNFT,
  //         "OwnableUnauthorizedAccount"
  //       )
  //       .withArgs(other.address);
  //   });

  //   it("Should not allow setting zero address as minter", async function () {
  //     await expect(
  //       inscriptionNFT.connect(owner).setMinter(ethers.ZeroAddress)
  //     ).to.be.revertedWith("Invalid minter address");
  //   });
  // });
});
