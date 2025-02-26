import { expect } from "chai";
import { ethers } from "hardhat";
import { LaunchNFTV2 } from "../typechain-types";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("LaunchNFTV2 Phase Management Tests", () => {
  let contract: LaunchNFTV2;
  let owner: SignerWithAddress;
  let backendSigner: SignerWithAddress;
  let platformFeeRecipient: SignerWithAddress;
  let minter: SignerWithAddress;
  let otherUser: SignerWithAddress;
  let currentTimestamp: number;

  const INITIAL_ROYALTY_FEE = 500; // 5%
  const INITIAL_PLATFORM_FEE = 250; // 2.5%
  const CONTRACT_NAME = "Phase Test NFT";
  const CONTRACT_SYMBOL = "PTNFT";

  // Define phase types for readability
  const PhaseType = {
    NOT_STARTED: 0,
    WHITELIST: 1,
    PUBLIC: 2
  };

  before(async () => {
    await ethers.provider.send("hardhat_reset", [
      {
        allowBlocksWithSameTimestamp: true
      }
    ]);

    const latestBlock = await ethers.provider.getBlock("latest");
    currentTimestamp = Number(latestBlock!.timestamp);
  });

  after(async () => {
    await ethers.provider.send("hardhat_reset", []);
  });

  async function mineBlock(timestamp?: number) {
    await ethers.provider.send("evm_mine", timestamp ? [timestamp] : []);
    // Update currentTimestamp after mining
    const latestBlock = await ethers.provider.getBlock("latest");
    currentTimestamp = Number(latestBlock!.timestamp);
  }

  async function advanceTime(seconds: number) {
    currentTimestamp += seconds;
    await ethers.provider.send("evm_setNextBlockTimestamp", [currentTimestamp]);
    await mineBlock();
    return currentTimestamp;
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

    // Update currentTimestamp after deployment
    const latestBlock = await ethers.provider.getBlock("latest");
    currentTimestamp = Number(latestBlock!.timestamp);
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
  });

  describe("Adding Phases", () => {
    it("should allow owner to add a whitelist phase", async () => {
      const { root } = createMerkleProof([minter.address]);

      const startTime = currentTimestamp + 100;
      const endTime = startTime + 1000;

      await expect(
        contract.connect(owner).addPhase(
          PhaseType.WHITELIST,
          ethers.parseEther("0.1"),
          BigInt(startTime),
          BigInt(endTime),
          100, // maxSupply
          5, // maxPerWallet
          root
        )
      ).to.emit(contract, "PhaseAdded");

      const phaseCount = await contract.getPhaseCount();
      expect(phaseCount).to.equal(1); // Initial NOT_STARTED phase + new phase

      // Advance to the phase and check it's active
      await advanceTime(200);

      const [phaseIndex, phase] = await contract.getActivePhase();
      expect(phaseIndex).to.equal(0);
      expect(phase.phaseType).to.equal(PhaseType.WHITELIST);
      expect(phase.price).to.equal(ethers.parseEther("0.1"));
      expect(phase.startTime).to.equal(startTime);
      expect(phase.endTime).to.equal(endTime);
      expect(phase.maxSupply).to.equal(100);
      expect(phase.maxPerWallet).to.equal(5);
      expect(phase.merkleRoot).to.equal(root);
    });

    it("should allow owner to add a public phase", async () => {
      const startTime = currentTimestamp + 100;
      const endTime = startTime + 1000;

      await expect(
        contract.connect(owner).addPhase(
          PhaseType.PUBLIC,
          ethers.parseEther("0.2"),
          BigInt(startTime),
          BigInt(endTime),
          200, // maxSupply
          0, // No wallet limit for public
          ethers.ZeroHash
        )
      ).to.emit(contract, "PhaseAdded");

      const phaseCount = await contract.getPhaseCount();
      expect(phaseCount).to.equal(1);

      // Advance to the phase and check it's active
      await advanceTime(200);

      const [phaseIndex, phase] = await contract.getActivePhase();
      expect(phase.phaseType).to.equal(PhaseType.PUBLIC);
      expect(phase.price).to.equal(ethers.parseEther("0.2"));
    });

    it("should prevent non-owner from adding a phase", async () => {
      const { root } = createMerkleProof([minter.address]);

      const startTime = currentTimestamp + 100;
      const endTime = startTime + 1000;

      await expect(
        contract
          .connect(minter)
          .addPhase(
            PhaseType.WHITELIST,
            ethers.parseEther("0.1"),
            BigInt(startTime),
            BigInt(endTime),
            100,
            5,
            root
          )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should reject whitelist phase without merkle root", async () => {
      const startTime = currentTimestamp + 100;
      const endTime = startTime + 1000;

      await expect(
        contract.connect(owner).addPhase(
          PhaseType.WHITELIST,
          ethers.parseEther("0.1"),
          BigInt(startTime),
          BigInt(endTime),
          100,
          5,
          ethers.ZeroHash // Invalid - empty merkle root
        )
      ).to.be.revertedWith("Invalid params");
    });

    it("should reject phase with invalid time range", async () => {
      const { root } = createMerkleProof([minter.address]);

      const startTime = currentTimestamp + 1000;
      const endTime = startTime - 500; // End before start

      await expect(
        contract
          .connect(owner)
          .addPhase(
            PhaseType.WHITELIST,
            ethers.parseEther("0.1"),
            BigInt(startTime),
            BigInt(endTime),
            100,
            5,
            root
          )
      ).to.be.revertedWith("Invalid time");
    });

    it("should reject overlapping phases", async () => {
      const { root } = createMerkleProof([minter.address]);

      // Add first phase
      const phase1Start = currentTimestamp + 100;
      const phase1End = phase1Start + 1000;

      await contract
        .connect(owner)
        .addPhase(
          PhaseType.WHITELIST,
          ethers.parseEther("0.1"),
          BigInt(phase1Start),
          BigInt(phase1End),
          100,
          5,
          root
        );

      // Try to add overlapping phase
      const phase2Start = phase1Start + 500; // Overlaps with first phase
      const phase2End = phase2Start + 1000;

      await expect(
        contract
          .connect(owner)
          .addPhase(
            PhaseType.PUBLIC,
            ethers.parseEther("0.2"),
            BigInt(phase2Start),
            BigInt(phase2End),
            200,
            0,
            ethers.ZeroHash
          )
      ).to.be.revertedWith("Phase time overlaps with existing phase");
    });

    it("should allow adding multiple non-overlapping phases", async () => {
      const { root } = createMerkleProof([minter.address]);

      // Add first phase
      const phase1Start = currentTimestamp + 100;
      const phase1End = phase1Start + 1000;

      await contract
        .connect(owner)
        .addPhase(
          PhaseType.WHITELIST,
          ethers.parseEther("0.1"),
          BigInt(phase1Start),
          BigInt(phase1End),
          100,
          5,
          root
        );

      // Add second phase after first
      const phase2Start = phase1End + 100; // No overlap
      const phase2End = phase2Start + 1000;

      await contract
        .connect(owner)
        .addPhase(
          PhaseType.PUBLIC,
          ethers.parseEther("0.2"),
          BigInt(phase2Start),
          BigInt(phase2End),
          200,
          0,
          ethers.ZeroHash
        );

      // Add third phase after second
      const phase3Start = phase2End + 100; // No overlap
      const phase3End = phase3Start + 1000;

      await contract
        .connect(owner)
        .addPhase(
          PhaseType.PUBLIC,
          ethers.parseEther("0.3"),
          BigInt(phase3Start),
          BigInt(phase3End),
          300,
          0,
          ethers.ZeroHash
        );

      const phaseCount = await contract.getPhaseCount();
      expect(phaseCount).to.equal(3); // new phases
    });
  });

  describe("Updating Phases", () => {
    beforeEach(async () => {
      // Add a whitelist phase for testing updates
      const { root } = createMerkleProof([minter.address]);

      const startTime = currentTimestamp + 100;
      const endTime = startTime + 1000;

      await contract
        .connect(owner)
        .addPhase(
          PhaseType.WHITELIST,
          ethers.parseEther("0.1"),
          BigInt(startTime),
          BigInt(endTime),
          100,
          5,
          root
        );
    });

    it("should allow owner to update phase parameters", async () => {
      const phaseIndex = 0; // Index of the phase we added
      const newPrice = ethers.parseEther("0.2");
      const newStartTime = currentTimestamp + 200;
      const newEndTime = newStartTime + 2000;
      const newMaxSupply = 200;
      const newMaxPerWallet = 10;
      const { root: newRoot } = createMerkleProof([
        minter.address,
        otherUser.address
      ]);

      await expect(
        contract.connect(owner).updatePhase(
          phaseIndex,
          PhaseType.WHITELIST, // Same phase type
          newPrice,
          BigInt(newStartTime),
          BigInt(newEndTime),
          newMaxSupply,
          newMaxPerWallet,
          newRoot
        )
      ).to.emit(contract, "PhaseUpdated");

      // Advance to the phase and check it's updated
      await advanceTime(300);

      const [_, phase] = await contract.getActivePhase();
      expect(phase.price).to.equal(newPrice);
      expect(phase.startTime).to.equal(newStartTime);
      expect(phase.endTime).to.equal(newEndTime);
      expect(phase.maxSupply).to.equal(newMaxSupply);
      expect(phase.maxPerWallet).to.equal(newMaxPerWallet);
      expect(phase.merkleRoot).to.equal(newRoot);
    });

    it("should allow changing phase type during update", async () => {
      const phaseIndex = 0;
      const newStartTime = currentTimestamp + 200;
      const newEndTime = newStartTime + 2000;

      await contract.connect(owner).updatePhase(
        phaseIndex,
        PhaseType.PUBLIC, // Change to public
        ethers.parseEther("0.2"),
        BigInt(newStartTime),
        BigInt(newEndTime),
        200,
        0, // No wallet limit for public
        ethers.ZeroHash // No merkle root for public
      );

      // Advance to the phase and check it's updated
      await advanceTime(300);

      const [_, phase] = await contract.getActivePhase();
      expect(phase.phaseType).to.equal(PhaseType.PUBLIC);
    });

    it("should prevent non-owner from updating a phase", async () => {
      const phaseIndex = 1;
      const newStartTime = currentTimestamp + 200;
      const newEndTime = newStartTime + 2000;
      const { root } = createMerkleProof([minter.address]);

      await expect(
        contract
          .connect(minter)
          .updatePhase(
            phaseIndex,
            PhaseType.WHITELIST,
            ethers.parseEther("0.2"),
            BigInt(newStartTime),
            BigInt(newEndTime),
            200,
            10,
            root
          )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should reject update with invalid phase index", async () => {
      const invalidPhaseIndex = 99; // Does not exist
      const newStartTime = currentTimestamp + 200;
      const newEndTime = newStartTime + 2000;
      const { root } = createMerkleProof([minter.address]);

      await expect(
        contract
          .connect(owner)
          .updatePhase(
            invalidPhaseIndex,
            PhaseType.WHITELIST,
            ethers.parseEther("0.2"),
            BigInt(newStartTime),
            BigInt(newEndTime),
            200,
            10,
            root
          )
      ).to.be.revertedWith("Invalid phase index");
    });

    it("should reject update with invalid time range", async () => {
      const phaseIndex = 0;
      const newStartTime = currentTimestamp + 200;
      const newEndTime = newStartTime - 100; // End before start
      const { root } = createMerkleProof([minter.address]);

      await expect(
        contract
          .connect(owner)
          .updatePhase(
            phaseIndex,
            PhaseType.WHITELIST,
            ethers.parseEther("0.2"),
            BigInt(newStartTime),
            BigInt(newEndTime),
            200,
            10,
            root
          )
      ).to.be.revertedWith("Invalid time");
    });

    it("should reject update causing overlapping phases", async () => {
      // Add a second phase
      const phase2Start = currentTimestamp + 2000;
      const phase2End = phase2Start + 1000;

      await contract
        .connect(owner)
        .addPhase(
          PhaseType.PUBLIC,
          ethers.parseEther("0.2"),
          BigInt(phase2Start),
          BigInt(phase2End),
          200,
          0,
          ethers.ZeroHash
        );

      // Try to update first phase to overlap with second
      const phaseIndex = 0;
      const newStartTime = currentTimestamp + 200;
      const newEndTime = phase2Start + 500; // Overlaps with second phase
      const { root } = createMerkleProof([minter.address]);

      await expect(
        contract
          .connect(owner)
          .updatePhase(
            phaseIndex,
            PhaseType.WHITELIST,
            ethers.parseEther("0.2"),
            BigInt(newStartTime),
            BigInt(newEndTime),
            200,
            10,
            root
          )
      ).to.be.revertedWith("Phase time overlaps with existing phase");
    });

    it("should update phase while preserving mintedInPhase count", async () => {
      // Set up to mint in the phase first
      const phaseIndex = 0;

      // Advance to the phase
      await advanceTime(200);

      // Get signature for minting
      const tokenId = "1";
      const uri = "ipfs://test";

      // Generate signature for current phase
      const domain = {
        name: "UnifiedNFT",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await contract.getAddress()
      };

      const uniqueId = ethers.keccak256(
        ethers.solidityPacked(
          ["address", "uint256", "string", "uint256"],
          [minter.address, tokenId, uri, Date.now()]
        )
      );

      const timestamp = currentTimestamp;

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
        minter: minter.address,
        tokenId,
        uri,
        price: ethers.parseEther("0.1"),
        phaseIndex,
        uniqueId,
        timestamp
      };

      const signature = await backendSigner.signTypedData(domain, types, value);

      // Get merkle proof for minter
      const { proof } = createMerkleProof([minter.address]);

      // Mint a token
      await contract
        .connect(minter)
        .mint(tokenId, uri, uniqueId, timestamp, signature, proof, {
          value: ethers.parseEther("0.1")
        });

      // Get current minted count
      const [_, phase] = await contract.getActivePhase();
      const mintedBefore = phase.mintedInPhase;
      expect(mintedBefore).to.equal(1);

      // Update the phase
      const newStartTime = currentTimestamp - 50; // To keep it active
      const newEndTime = newStartTime + 2000;
      const { root } = createMerkleProof([minter.address, otherUser.address]);

      await contract
        .connect(owner)
        .updatePhase(
          phaseIndex,
          PhaseType.WHITELIST,
          ethers.parseEther("0.2"),
          BigInt(newStartTime),
          BigInt(newEndTime),
          200,
          10,
          root
        );

      // Check mintedInPhase is preserved
      const [__, updatedPhase] = await contract.getActivePhase();
      expect(updatedPhase.mintedInPhase).to.equal(mintedBefore);
    });
  });

  describe("Phase Status Querying", () => {
    it("should correctly report when no phase is active", async () => {
      // Add a future phase
      const { root } = createMerkleProof([minter.address]);

      const startTime = currentTimestamp + 1000;
      const endTime = startTime + 1000;

      await contract
        .connect(owner)
        .addPhase(
          PhaseType.WHITELIST,
          ethers.parseEther("0.1"),
          BigInt(startTime),
          BigInt(endTime),
          100,
          5,
          root
        );

      // Attempt to get active phase before it starts
      await expect(contract.getActivePhase()).to.be.revertedWith(
        "No active phase"
      );
    });

    it("should return correct phase count", async () => {
      // Initial phase count
      expect(await contract.getPhaseCount()).to.equal(0);

      // Add a phase
      const { root } = createMerkleProof([minter.address]);

      const startTime = currentTimestamp + 100;
      const endTime = startTime + 1000;

      await contract
        .connect(owner)
        .addPhase(
          PhaseType.WHITELIST,
          ethers.parseEther("0.1"),
          BigInt(startTime),
          BigInt(endTime),
          100,
          5,
          root
        );

      expect(await contract.getPhaseCount()).to.equal(1);

      // Add another phase
      const phase2Start = endTime + 100;
      const phase2End = phase2Start + 1000;

      await contract
        .connect(owner)
        .addPhase(
          PhaseType.PUBLIC,
          ethers.parseEther("0.2"),
          BigInt(phase2Start),
          BigInt(phase2End),
          200,
          0,
          ethers.ZeroHash
        );

      expect(await contract.getPhaseCount()).to.equal(2);
    });

    it("should return correct phase when multiple exist", async () => {
      // Add first phase
      const { root } = createMerkleProof([minter.address]);

      const phase1Start = currentTimestamp + 100;
      const phase1End = phase1Start + 1000;

      await contract
        .connect(owner)
        .addPhase(
          PhaseType.WHITELIST,
          ethers.parseEther("0.1"),
          BigInt(phase1Start),
          BigInt(phase1End),
          100,
          5,
          root
        );

      // Add second phase
      const phase2Start = phase1End + 100;
      const phase2End = phase2Start + 1000;

      await contract
        .connect(owner)
        .addPhase(
          PhaseType.PUBLIC,
          ethers.parseEther("0.2"),
          BigInt(phase2Start),
          BigInt(phase2End),
          200,
          0,
          ethers.ZeroHash
        );

      // Move to first phase
      await advanceTime(200);

      // Check active phase is first one
      const [phaseIndex1, phase1] = await contract.getActivePhase();
      expect(phaseIndex1).to.equal(0);
      expect(phase1.phaseType).to.equal(PhaseType.WHITELIST);

      // Move to second phase
      await advanceTime(phase2Start - currentTimestamp);

      // Check active phase is second one
      const [phaseIndex2, phase2] = await contract.getActivePhase();
      expect(phaseIndex2).to.equal(1);
      expect(phase2.phaseType).to.equal(PhaseType.PUBLIC);
    });

    it("should track minted tokens per wallet per phase", async () => {
      // Add whitelist phase
      const { root, proof } = createMerkleProof([minter.address]);

      const startTime = currentTimestamp + 100;
      const endTime = startTime + 1000;

      await contract
        .connect(owner)
        .addPhase(
          PhaseType.WHITELIST,
          ethers.parseEther("0.1"),
          BigInt(startTime),
          BigInt(endTime),
          100,
          5,
          root
        );

      // Advance to phase
      await advanceTime(200);

      // Get phase index
      const [phaseIndex] = await contract.getActivePhase();

      // Mint 2 tokens
      for (let i = 1; i <= 2; i++) {
        const tokenId = i.toString();
        const uri = `ipfs://test${i}`;

        // Generate signature
        const domain = {
          name: "UnifiedNFT",
          version: "1",
          chainId: (await ethers.provider.getNetwork()).chainId,
          verifyingContract: await contract.getAddress()
        };

        const uniqueId = ethers.keccak256(
          ethers.solidityPacked(
            ["address", "uint256", "string", "uint256"],
            [minter.address, tokenId, uri, Date.now() + i]
          )
        );

        const timestamp = currentTimestamp + i;

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
          minter: minter.address,
          tokenId,
          uri,
          price: ethers.parseEther("0.1"),
          phaseIndex,
          uniqueId,
          timestamp
        };

        const signature = await backendSigner.signTypedData(
          domain,
          types,
          value
        );

        // Set blockchain time
        await advanceTime(10);

        // Mint
        await contract
          .connect(minter)
          .mint(tokenId, uri, uniqueId, timestamp, signature, proof, {
            value: ethers.parseEther("0.1")
          });
      }

      // Check minted count for minter in whitelist phase
      const mintedCount = await contract.getMintedInPhase(
        minter.address,
        PhaseType.WHITELIST
      );
      expect(mintedCount).to.equal(2);

      // Check minted count for other user (should be 0)
      const otherUserMintedCount = await contract.getMintedInPhase(
        otherUser.address,
        PhaseType.WHITELIST
      );
      expect(otherUserMintedCount).to.equal(0);
    });
  });
});
