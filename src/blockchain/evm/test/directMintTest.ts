import { expect } from "chai";
import { ethers } from "hardhat";
import { LaunchNFTV2 } from "../typechain-types";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("LaunchNFTV2 Contract", () => {
  let contract: LaunchNFTV2;
  let owner: SignerWithAddress;
  let backendSigner: SignerWithAddress;
  let platformFeeRecipient: SignerWithAddress;
  let minter: SignerWithAddress;
  let otherUser: SignerWithAddress;
  let globalTimestamp: number;

  const INITIAL_ROYALTY_FEE = 500; // 5%
  const INITIAL_PLATFORM_FEE = 250; // 2.5%
  const CONTRACT_NAME = "Test NFT";
  const CONTRACT_SYMBOL = "TNFT";

  // Enable blocks with same timestamp before all tests
  before(async () => {
    await ethers.provider.send("hardhat_reset", [
      {
        allowBlocksWithSameTimestamp: true
      }
    ]);
    const latestBlock = await ethers.provider.getBlock("latest");
    globalTimestamp = Number(latestBlock!.timestamp);
  });

  // Reset network after all tests
  after(async () => {
    await ethers.provider.send("hardhat_reset", []);
  });

  async function mineBlock(timestamp?: number) {
    await ethers.provider.send("evm_mine", timestamp ? [timestamp] : []);
  }

  async function deployContract() {
    const Factory = await ethers.getContractFactory("LaunchNFTV2", owner);
    contract = await Factory.deploy(
      await owner.getAddress(),
      CONTRACT_NAME,
      CONTRACT_SYMBOL,
      INITIAL_ROYALTY_FEE,
      INITIAL_PLATFORM_FEE,
      await platformFeeRecipient.getAddress(),
      await backendSigner.getAddress()
    );
    await contract.waitForDeployment();
    await mineBlock();
  }

  async function generateSignature(
    minterAddress: string,
    tokenId: string,
    uri: string,
    price: string,
    phaseIndex: number
  ) {
    const domain = {
      name: "UnifiedNFT",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await contract.getAddress()
    };

    const uniqueId = ethers.keccak256(
      ethers.solidityPacked(
        ["address", "uint256", "string", "uint256"],
        [minterAddress, tokenId, uri, Date.now()]
      )
    );

    const timestamp = Math.floor(Date.now() / 1000);

    const types = {
      MintRequest: [
        { name: "minter", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "uri", type: "string" },
        { name: "price", type: "uint256" },
        { name: "phaseIndex", type: "uint256" },
        { name: "uniqueId", type: "bytes32" },
        { name: "timestamp", type: "uint256" }
      ]
    };

    const value = {
      minter: minterAddress,
      tokenId: tokenId,
      uri: uri,
      price: ethers.parseEther(price),
      phaseIndex: phaseIndex,
      uniqueId: uniqueId,
      timestamp: timestamp
    };

    const signature = await backendSigner.signTypedData(domain, types, value);
    return { signature, uniqueId, timestamp };
  }

  function createMerkleProof(addresses: string[]) {
    const leaves = addresses.map((addr) => keccak256(addr));
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();
    const proof = tree.getHexProof(keccak256(addresses[0]));
    return { root, proof };
  }

  beforeEach(async () => {
    [owner, backendSigner, platformFeeRecipient, minter, otherUser] =
      await ethers.getSigners();
    await deployContract();
    const latestBlock = await ethers.provider.getBlock("latest");
    globalTimestamp = Number(latestBlock!.timestamp);
  });

  describe("Deployment", () => {
    it("should deploy with correct initial values", async () => {
      expect(await contract.name()).to.equal(CONTRACT_NAME);
      expect(await contract.symbol()).to.equal(CONTRACT_SYMBOL);
      expect(await contract.platformFeePercentage()).to.equal(
        INITIAL_PLATFORM_FEE
      );
      expect(await contract.platformFeeRecipient()).to.equal(
        platformFeeRecipient.address
      );
      expect(await contract.backendSigner()).to.equal(backendSigner.address);
    });

    it("should have initial NOT_STARTED phase", async () => {
      const phaseCount = await contract.getPhaseCount();
      expect(phaseCount).to.equal(BigInt(1));

      await expect(contract.getActivePhase()).to.be.revertedWithCustomError(
        contract,
        "NoActivePhase"
      );
    });
  });
  describe("Phase Management", () => {
    let currentTime: number;
    let whitelistRoot: string;
    let whitelistProof: string[];

    beforeEach(async () => {
      const latestBlock = await ethers.provider.getBlock("latest");
      currentTime = Number(latestBlock!.timestamp);
      const { root, proof } = createMerkleProof([minter.address]);
      whitelistRoot = root;
      whitelistProof = proof;
    });

    it("should add whitelist phase correctly", async () => {
      await contract.connect(owner).addPhase(
        1, // WHITELIST
        ethers.parseEther("0.1"),
        BigInt(globalTimestamp + 100),
        BigInt(globalTimestamp + 86400),
        100, // maxSupply
        2, // maxPerWallet
        whitelistRoot
      );

      const phaseCount = await contract.getPhaseCount();
      expect(phaseCount).to.equal(BigInt(2));

      // Fast forward time to whitelist phase
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        globalTimestamp + 100
      ]);
      await ethers.provider.send("evm_mine", []);

      const [phaseIndex, phase] = await contract.getActivePhase();
      expect(phase.phaseType).to.equal(1); // WHITELIST
      expect(phase.price).to.equal(ethers.parseEther("0.1"));
    });

    it("should prevent adding phase with invalid parameters", async () => {
      // Try to add whitelist phase without merkle root
      await expect(
        contract.connect(owner).addPhase(
          1, // WHITELIST
          ethers.parseEther("0.1"),
          BigInt(globalTimestamp + 100),
          BigInt(globalTimestamp + 86400),
          100,
          2,
          ethers.ZeroHash // Invalid - empty merkle root
        )
      ).to.be.revertedWith("Merkle root required for whitelist phase");
    });

    it("should prevent overlapping phases", async () => {
      // Add first phase
      await contract
        .connect(owner)
        .addPhase(
          1,
          ethers.parseEther("0.1"),
          BigInt(globalTimestamp + 100),
          BigInt(globalTimestamp + 86400),
          100,
          2,
          whitelistRoot
        );

      // Try to add overlapping phase
      await expect(
        contract.connect(owner).addPhase(
          2, // PUBLIC
          ethers.parseEther("0.2"),
          BigInt(globalTimestamp + 86000), // Overlaps with first phase
          BigInt(globalTimestamp + 172800),
          0,
          0,
          ethers.ZeroHash
        )
      ).to.be.revertedWithCustomError(contract, "OverlappingPhases");
    });
  });

  describe("Minting", () => {
    let whitelistRoot: string;
    let whitelistProof: string[];

    beforeEach(async () => {
      const { root, proof } = createMerkleProof([minter.address]);
      whitelistRoot = root;
      whitelistProof = proof;

      // Add whitelist phase
      await contract.connect(owner).addPhase(
        1, // WHITELIST
        ethers.parseEther("0.1"),
        BigInt(globalTimestamp),
        BigInt(globalTimestamp + 86400),
        100,
        2,
        whitelistRoot
      );
      await mineBlock();
    });

    it("should mint successfully in whitelist phase", async () => {
      const tokenId = "1";
      const uri = "ipfs://test";
      const { signature, uniqueId, timestamp } = await generateSignature(
        minter.address,
        tokenId,
        uri,
        "0.1",
        1
      );

      await contract
        .connect(minter)
        .mint(tokenId, uri, uniqueId, timestamp, signature, whitelistProof, {
          value: ethers.parseEther("0.1")
        });

      expect(await contract.ownerOf(tokenId)).to.equal(minter.address);
      expect(await contract.tokenURI(tokenId)).to.equal(uri);
    });

    it("should fail mint with invalid merkle proof", async () => {
      const tokenId = "1";
      const uri = "ipfs://test";
      const { signature, uniqueId, timestamp } = await generateSignature(
        minter.address,
        tokenId,
        uri,
        "0.1",
        1
      );

      const invalidProof = [ethers.ZeroHash];

      await expect(
        contract
          .connect(minter)
          .mint(tokenId, uri, uniqueId, timestamp, signature, invalidProof, {
            value: ethers.parseEther("0.1")
          })
      ).to.be.revertedWithCustomError(contract, "InvalidMerkleProof");
    });

    it("should fail mint with expired timestamp", async () => {
      const tokenId = "1";
      const uri = "ipfs://test";
      const { signature, uniqueId } = await generateSignature(
        minter.address,
        tokenId,
        uri,
        "0.1",
        1
      );

      const expiredTimestamp = Math.floor(Date.now() / 1000) - 7200; // 2 hours ago

      await expect(
        contract
          .connect(minter)
          .mint(
            tokenId,
            uri,
            uniqueId,
            expiredTimestamp,
            signature,
            whitelistProof,
            {
              value: ethers.parseEther("0.1")
            }
          )
      ).to.be.revertedWithCustomError(contract, "SignatureExpired");
    });
    it("should fail mint with reused uniqueId", async () => {
      const tokenId = "1";
      const uri = "ipfs://test";
      const { signature, uniqueId, timestamp } = await generateSignature(
        minter.address,
        tokenId,
        uri,
        "0.1",
        1
      );

      // First mint succeeds
      await contract
        .connect(minter)
        .mint(tokenId, uri, uniqueId, timestamp, signature, whitelistProof, {
          value: ethers.parseEther("0.1")
        });

      // Second mint with same uniqueId fails
      const tokenId2 = "2";
      await expect(
        contract
          .connect(minter)
          .mint(tokenId2, uri, uniqueId, timestamp, signature, whitelistProof, {
            value: ethers.parseEther("0.1")
          })
      ).to.be.revertedWithCustomError(contract, "InvalidSignature");
    });

    it("should fail mint with incorrect payment", async () => {
      const tokenId = "1";
      const uri = "ipfs://test";
      // const deadline = globalTimestamp + 3600;
      const { signature, uniqueId, timestamp } = await generateSignature(
        minter.address,
        tokenId,
        uri,
        "0.1",
        1
      );

      await expect(
        contract.connect(minter).mint(
          tokenId,
          uri,
          uniqueId,
          timestamp,
          signature,
          whitelistProof,
          { value: ethers.parseEther("0.05") } // Incorrect payment
        )
      ).to.be.revertedWithCustomError(contract, "PriceMismatch");
    });
  });

  describe("Fee Distribution", () => {
    beforeEach(async () => {
      // Add public phase
      await contract.connect(owner).addPhase(
        2, // PUBLIC
        ethers.parseEther("1.0"),
        BigInt(globalTimestamp),
        BigInt(globalTimestamp + 86400),
        0,
        0,
        ethers.ZeroHash
      );
      await mineBlock();
    });

    it("should distribute fees correctly on mint", async () => {
      const tokenId = "1";
      const uri = "ipfs://test";
      const deadline = globalTimestamp + 3600;
      // const nonce = await contract.getNonce(minter.address);
      const mintPrice = "1.0";

      const { signature, uniqueId, timestamp } = await generateSignature(
        minter.address,
        tokenId,
        uri,
        mintPrice,
        1
      );

      const initialOwnerBalance = await ethers.provider.getBalance(
        owner.address
      );
      const initialPlatformBalance = await ethers.provider.getBalance(
        platformFeeRecipient.address
      );

      await contract
        .connect(minter)
        .mint(tokenId, uri, uniqueId, timestamp, signature, [], {
          value: ethers.parseEther(mintPrice)
        });

      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
      const finalPlatformBalance = await ethers.provider.getBalance(
        platformFeeRecipient.address
      );

      const platformFeeAmount =
        (BigInt(ethers.parseEther(mintPrice)) * BigInt(INITIAL_PLATFORM_FEE)) /
        BigInt(10000);
      const ownerAmount =
        BigInt(ethers.parseEther(mintPrice)) - platformFeeAmount;

      expect(finalPlatformBalance - initialPlatformBalance).to.equal(
        platformFeeAmount
      );
      expect(finalOwnerBalance - initialOwnerBalance).to.equal(ownerAmount);
    });
  });

  describe("Public Phase Minting", () => {
    beforeEach(async () => {
      // Add public phase with typical configuration
      await contract.connect(owner).addPhase(
        2, // PUBLIC
        ethers.parseEther("0.5"), // 0.5 ETH price
        BigInt(globalTimestamp),
        BigInt(globalTimestamp + 86400), // 24 hours duration
        1000, // maxSupply
        5, // maxPerWallet
        ethers.ZeroHash // No merkle root needed for public
      );
      await mineBlock();
    });

    it("should mint successfully in public phase", async () => {
      const tokenId = "1";
      const uri = "ipfs://test";
      const { signature, uniqueId, timestamp } = await generateSignature(
        minter.address,
        tokenId,
        uri,
        "0.5",
        1
      );

      // Mine block with current timestamp to ensure signature is valid
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mineBlock();

      await contract.connect(minter).mint(
        tokenId,
        uri,
        uniqueId,
        timestamp,
        signature,
        [], // Empty proof for public phase
        { value: ethers.parseEther("0.5") }
      );

      expect(await contract.ownerOf(tokenId)).to.equal(minter.address);
      expect(await contract.tokenURI(tokenId)).to.equal(uri);
      expect(await contract.getMintedInPhase(minter.address, 2)).to.equal(1); // PhaseType.PUBLIC = 2
    });

    it("should mint multiple tokens up to maxPerWallet", async () => {
      // Mint 5 tokens (maxPerWallet)
      for (let i = 1; i <= 5; i++) {
        const tokenId = i.toString();
        const uri = `ipfs://test${i}`;
        const { signature, uniqueId, timestamp } = await generateSignature(
          minter.address,
          tokenId,
          uri,
          "0.5",
          1
        );

        // Set block timestamp for each mint
        await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
        await mineBlock();

        await contract
          .connect(minter)
          .mint(tokenId, uri, uniqueId, timestamp, signature, [], {
            value: ethers.parseEther("0.5")
          });
      }

      expect(await contract.getMintedInPhase(minter.address, 2)).to.equal(5);

      // Attempt to mint one more should fail
      const tokenId = "6";
      const uri = "ipfs://test6";
      const { signature, uniqueId, timestamp } = await generateSignature(
        minter.address,
        tokenId,
        uri,
        "0.5",
        1
      );

      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mineBlock();

      await expect(
        contract
          .connect(minter)
          .mint(tokenId, uri, uniqueId, timestamp, signature, [], {
            value: ethers.parseEther("0.5")
          })
      ).to.be.revertedWithCustomError(contract, "ExceedsWalletLimit");
    });

    it("should allow unlimited mints when maxPerWallet is 0", async () => {
      // Add new public phase with unlimited mints per wallet
      const newPhaseStartTime = globalTimestamp + 100000;
      await contract.connect(owner).addPhase(
        2, // PUBLIC
        ethers.parseEther("0.1"),
        BigInt(newPhaseStartTime),
        BigInt(newPhaseStartTime + 86400),
        0, // No max supply
        0, // No wallet limit
        ethers.ZeroHash
      );

      // Fast forward to new phase
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        newPhaseStartTime
      ]);
      await mineBlock();

      // Mint 10 tokens (arbitrary number > default max)
      for (let i = 1; i <= 10; i++) {
        const tokenId = i.toString();
        const uri = `ipfs://unlimited${i}`;
        const { signature, uniqueId, timestamp } = await generateSignature(
          minter.address,
          tokenId,
          uri,
          "0.1",
          2 // Phase index is 2 since we added a new phase
        );

        await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
        await mineBlock();

        await contract
          .connect(minter)
          .mint(tokenId, uri, uniqueId, timestamp, signature, [], {
            value: ethers.parseEther("0.1")
          });
      }

      expect(await contract.getMintedInPhase(minter.address, 2)).to.equal(10);
    });

    it("should respect maxSupply limit", async () => {
      // Add phase with very low max supply
      const newPhaseStartTime = globalTimestamp + 100000;
      await contract.connect(owner).addPhase(
        2, // PUBLIC
        ethers.parseEther("0.1"),
        BigInt(newPhaseStartTime),
        BigInt(newPhaseStartTime + 86400),
        2, // Max supply of 2
        5, // Max per wallet higher than max supply
        ethers.ZeroHash
      );

      // Fast forward to new phase
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        newPhaseStartTime
      ]);
      await mineBlock();

      // Mint up to max supply
      for (let i = 1; i <= 2; i++) {
        const tokenId = i.toString();
        const uri = `ipfs://maxsupply${i}`;
        const { signature, uniqueId, timestamp } = await generateSignature(
          minter.address,
          tokenId,
          uri,
          "0.1",
          2
        );

        await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
        await mineBlock();

        await contract
          .connect(minter)
          .mint(tokenId, uri, uniqueId, timestamp, signature, [], {
            value: ethers.parseEther("0.1")
          });
      }

      // Attempt to mint beyond max supply should fail
      const tokenId = "3";
      const uri = "ipfs://maxsupply3";
      const { signature, uniqueId, timestamp } = await generateSignature(
        minter.address,
        tokenId,
        uri,
        "0.1",
        2
      );

      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mineBlock();

      await expect(
        contract
          .connect(minter)
          .mint(tokenId, uri, uniqueId, timestamp, signature, [], {
            value: ethers.parseEther("0.1")
          })
      ).to.be.revertedWithCustomError(contract, "ExceedsPhaseSupply");
    });

    it("should fail mint with mismatched phase index in signature", async () => {
      const tokenId = "1";
      const uri = "ipfs://test";
      const { signature, uniqueId, timestamp } = await generateSignature(
        minter.address,
        tokenId,
        uri,
        "0.5",
        99 // Deliberately wrong phase index
      );

      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mineBlock();

      await expect(
        contract
          .connect(minter)
          .mint(tokenId, uri, uniqueId, timestamp, signature, [], {
            value: ethers.parseEther("0.5")
          })
      ).to.be.revertedWithCustomError(contract, "InvalidSignature");
    });

    it("should allow different users to mint up to their individual wallet limits", async () => {
      // First user mints 3 tokens
      for (let i = 1; i <= 3; i++) {
        const tokenId = i.toString();
        const uri = `ipfs://user1_${i}`;
        const { signature, uniqueId, timestamp } = await generateSignature(
          minter.address,
          tokenId,
          uri,
          "0.5",
          1
        );

        await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
        await mineBlock();

        await contract
          .connect(minter)
          .mint(tokenId, uri, uniqueId, timestamp, signature, [], {
            value: ethers.parseEther("0.5")
          });
      }

      // Second user mints 2 tokens
      for (let i = 4; i <= 5; i++) {
        const tokenId = i.toString();
        const uri = `ipfs://user2_${i}`;
        const { signature, uniqueId, timestamp } = await generateSignature(
          otherUser.address,
          tokenId,
          uri,
          "0.5",
          1
        );

        await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
        await mineBlock();

        await contract
          .connect(otherUser)
          .mint(tokenId, uri, uniqueId, timestamp, signature, [], {
            value: ethers.parseEther("0.5")
          });
      }

      expect(await contract.getMintedInPhase(minter.address, 2)).to.equal(3);
      expect(await contract.getMintedInPhase(otherUser.address, 2)).to.equal(2);
    });
  });
});
