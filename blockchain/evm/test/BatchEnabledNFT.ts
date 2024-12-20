import { expect } from "chai";
import { ethers } from "hardhat";
import { InscriptionNFT } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
describe("InscriptionNFT", function () {
  let inscriptionNFT: InscriptionNFT;
  let owner: SignerWithAddress;
  let minter: SignerWithAddress;
  let recipient: SignerWithAddress;
  let other: SignerWithAddress;
  const testNfitId = "nfit123";
  const testNfitId2 = "nfit1234";
  const testContractName = "NNFT";

  beforeEach(async function () {
    [owner, minter, recipient, other] = await ethers.getSigners();

    const InscriptionNFT = await ethers.getContractFactory("InscriptionNFT");
    inscriptionNFT = await InscriptionNFT.deploy(
      minter.address,
      owner.address,
      testContractName
    );
    await inscriptionNFT.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await inscriptionNFT.owner()).to.equal(owner.address);
    });

    it("Should set the correct minter", async function () {
      expect(await inscriptionNFT.minterAddress()).to.equal(minter.address);
    });
  });

  describe("Minting", function () {
    const testInscriptionId = "inscription123";

    it("Should allow minter to mint NFT", async function () {
      await expect(
        inscriptionNFT
          .connect(minter)
          .mint(recipient.address, testInscriptionId, testNfitId)
      )
        .to.emit(inscriptionNFT, "InscriptionMinted")
        .withArgs(1, recipient.address, testInscriptionId);

      expect(await inscriptionNFT.ownerOf(1)).to.equal(recipient.address);
      expect(await inscriptionNFT.getInscriptionId(1)).to.equal(
        testInscriptionId
      );
    });

    it("Should not allow non-minter to mint", async function () {
      await expect(
        inscriptionNFT
          .connect(other)
          .mint(recipient.address, testInscriptionId, testNfitId)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should not allow minting with empty inscription ID", async function () {
      await expect(
        inscriptionNFT.connect(minter).mint(recipient.address, "", testNfitId)
      ).to.be.revertedWith("Invalid inscription ID");
    });

    it("Should mint sequential token IDs", async function () {
      await inscriptionNFT
        .connect(minter)
        .mint(recipient.address, "inscription1", testNfitId);
      await inscriptionNFT
        .connect(minter)
        .mint(recipient.address, "inscription2", testNfitId2);

      expect(await inscriptionNFT.ownerOf(1)).to.equal(recipient.address);
      expect(await inscriptionNFT.ownerOf(2)).to.equal(recipient.address);
      expect(await inscriptionNFT.getInscriptionId(1)).to.equal("inscription1");
      expect(await inscriptionNFT.getInscriptionId(2)).to.equal("inscription2");
    });
  });

  describe("Inscription ID Retrieval", function () {
    it("Should fail to get inscription ID for non-existent token", async function () {
      await expect(inscriptionNFT.getInscriptionId(1)).to.be.revertedWith(
        "Token does not exist"
      );
    });
  });

  describe("Minter Management", function () {
    it("Should allow owner to change minter", async function () {
      await inscriptionNFT.connect(owner).setMinter(other.address);
      expect(await inscriptionNFT.minterAddress()).to.equal(other.address);
    });
    it("Should not allow non-owner to change minter", async function () {
      await expect(inscriptionNFT.connect(other).setMinter(other.address))
        .to.be.revertedWithCustomError(
          inscriptionNFT,
          "OwnableUnauthorizedAccount"
        )
        .withArgs(other.address);
    });

    it("Should not allow setting zero address as minter", async function () {
      await expect(
        inscriptionNFT.connect(owner).setMinter(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid minter address");
    });
  });
});
