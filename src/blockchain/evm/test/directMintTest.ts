import { expect } from "chai";
import { ethers } from "hardhat";
import { LaunchNFTV3 } from "../typechain-types";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("LaunchNFTV3 Tests", () => {
  let contract: LaunchNFTV3;
  let owner: SignerWithAddress;
  let backendSigner: SignerWithAddress;
  let platformFeeRecipient: SignerWithAddress;
  let minter: SignerWithAddress;
  let otherUser: SignerWithAddress;
  let baseTimestamp: number; // Base timestamp for all tests
  let currentTimestamp: number; // Track the current timestamp to avoid conflicts

  const INITIAL_ROYALTY_FEE = 500; // 5%
  const INITIAL_PLATFORM_FEE = 250; // 2.5%
  const CONTRACT_NAME = "Test NFT";
  const CONTRACT_SYMBOL = "TNFT";

  // Phase type enum values - updated order based on your changes
  enum PhaseType {
    WHITELIST = 0,
    FCFS = 1,
    PUBLIC = 2
  }

  // Helper function to add phase
  async function addPhase(
    phaseType: PhaseType,
    price: string,
    startOffset: number,
    duration: number,
    maxSupply: number = 0,
    maxPerWallet: number = 10
  ) {
    const phaseStart = currentTimestamp + startOffset;
    const phaseEnd = phaseStart + duration;

    await contract
      .connect(owner)
      .addPhase(
        phaseType,
        ethers.parseEther(price),
        BigInt(phaseStart),
        BigInt(phaseEnd),
        maxSupply,
        maxPerWallet
      );

    // Just create the phase but don't advance time yet
    return { phaseStart, phaseEnd };
  }

  // Setup and helper functions
  before(async () => {
    // Reset the hardhat network for a clean state
    await ethers.provider.send("hardhat_reset", []);
  });

  // Helper to advance time and mine a block
  async function advanceTimeAndBlock(time: number) {
    currentTimestamp += time;
    await ethers.provider.send("evm_setNextBlockTimestamp", [currentTimestamp]);
    await ethers.provider.send("evm_mine", []);
    return currentTimestamp;
  }

  async function deployContract() {
    const Factory = await ethers.getContractFactory("LaunchNFTV3", owner);
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

    // Get the latest block timestamp after deployment
    const latestBlock = await ethers.provider.getBlock("latest");
    baseTimestamp = Number(latestBlock!.timestamp);
    currentTimestamp = baseTimestamp; // Start tracking from here
  }

  // Create a robust signature generation function
  async function signMintRequest(
    minterAddress: string,
    tokenId: string,
    uri: string,
    price: string,
    phaseIndex: number,
    signatureTimestamp: number
  ) {
    const domain = {
      name: "UnifiedNFT",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await contract.getAddress()
    };

    // Create deterministic uniqueId
    const uniqueId = ethers.keccak256(
      ethers.solidityPacked(
        ["address", "uint256", "string", "uint256"],
        [minterAddress, tokenId, uri, signatureTimestamp]
      )
    );

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
      timestamp: signatureTimestamp
    };

    const signature = await backendSigner.signTypedData(domain, types, value);
    return { signature, uniqueId, timestamp: signatureTimestamp };
  }

  // Helper function to mint tokens that handles timestamps properly
  async function mintTokenInPhase(
    user: SignerWithAddress,
    tokenId: string,
    uri: string,
    price: string,
    phaseIndex: number
  ) {
    // Generate a signature using the current timestamp plus a small buffer
    const signatureTimestamp = currentTimestamp + 5;

    const { signature, uniqueId, timestamp } = await signMintRequest(
      user.address,
      tokenId,
      uri,
      price,
      phaseIndex,
      signatureTimestamp
    );

    // Advance time to match the signature timestamp
    await advanceTimeAndBlock(10); // Add a bit more time to ensure we're past the signature timestamp

    await contract
      .connect(user)
      .mint(tokenId, uri, uniqueId, timestamp, signature, {
        value: ethers.parseEther(price)
      });

    return { tokenId, uri };
  }

  beforeEach(async () => {
    [owner, backendSigner, platformFeeRecipient, minter, otherUser] =
      await ethers.getSigners();
    await deployContract();
  });

  describe("Phase Transitions", () => {
    it("should correctly transition from whitelist to public phase", async () => {
      // Add whitelist phase
      const { phaseStart: whitelistStart } = await addPhase(
        PhaseType.WHITELIST, // WHITELIST
        "0.1", // price
        100, // start in 100 seconds
        500 // duration 500 seconds
      );

      // Add public phase right after whitelist
      const { phaseStart: publicStart } = await addPhase(
        PhaseType.PUBLIC, // PUBLIC
        "0.2", // price
        600, // start after whitelist ends
        500 // duration 500 seconds
      );

      // Advance time to whitelist phase
      await advanceTimeAndBlock(110); // Go into whitelist phase

      // Verify we're in whitelist phase
      const [phaseIndex1, phase1] = await contract.getActivePhase();
      expect(phase1.phaseType).to.equal(PhaseType.WHITELIST); // WHITELIST

      // Mint during whitelist
      await mintTokenInPhase(
        minter,
        "1",
        "ipfs://whitelist",
        "0.1",
        Number(phaseIndex1)
      );

      // Advance time to public phase
      await advanceTimeAndBlock(500); // Move to public phase

      // Verify we're in public phase
      const [phaseIndex2, phase2] = await contract.getActivePhase();
      expect(phase2.phaseType).to.equal(PhaseType.PUBLIC); // PUBLIC

      // Mint during public phase
      await mintTokenInPhase(
        otherUser,
        "2",
        "ipfs://public",
        "0.2",
        Number(phaseIndex2)
      );

      // Verify both tokens were minted correctly
      expect(await contract.ownerOf("1")).to.equal(minter.address);
      expect(await contract.ownerOf("2")).to.equal(otherUser.address);
    });

    it("should correctly transition through whitelist, FCFS, and public phases", async () => {
      // Add whitelist phase
      await addPhase(
        PhaseType.WHITELIST, // WHITELIST
        "0.1", // price
        100, // start in 100 seconds
        300 // duration 300 seconds
      );

      // Add FCFS phase after whitelist
      await addPhase(
        PhaseType.FCFS, // FCFS
        "0.15", // price
        400, // start after whitelist ends
        300 // duration 300 seconds
      );

      // Add public phase after FCFS
      await addPhase(
        PhaseType.PUBLIC, // PUBLIC
        "0.2", // price
        700, // start after FCFS ends
        300 // duration 300 seconds
      );

      // Advance time to whitelist phase
      await advanceTimeAndBlock(110);

      // Verify we're in whitelist phase
      const [whitelistPhaseIndex, whitelistPhase] =
        await contract.getActivePhase();
      expect(whitelistPhase.phaseType).to.equal(PhaseType.WHITELIST);

      // Mint during whitelist
      await mintTokenInPhase(
        minter,
        "1",
        "ipfs://whitelist",
        "0.1",
        Number(whitelistPhaseIndex)
      );

      // Advance time to FCFS phase
      await advanceTimeAndBlock(300);

      // Verify we're in FCFS phase
      const [fcfsPhaseIndex, fcfsPhase] = await contract.getActivePhase();
      expect(fcfsPhase.phaseType).to.equal(PhaseType.FCFS);

      // Mint during FCFS
      await mintTokenInPhase(
        minter,
        "2",
        "ipfs://fcfs",
        "0.15",
        Number(fcfsPhaseIndex)
      );

      // Advance time to public phase
      await advanceTimeAndBlock(300);

      // Verify we're in public phase
      const [publicPhaseIndex, publicPhase] = await contract.getActivePhase();
      expect(publicPhase.phaseType).to.equal(PhaseType.PUBLIC);

      // Mint during public phase
      await mintTokenInPhase(
        otherUser,
        "3",
        "ipfs://public",
        "0.2",
        Number(publicPhaseIndex)
      );

      // Verify all tokens were minted correctly
      expect(await contract.ownerOf("1")).to.equal(minter.address);
      expect(await contract.ownerOf("2")).to.equal(minter.address);
      expect(await contract.ownerOf("3")).to.equal(otherUser.address);
    });
  });

  describe("FCFS Phase Specific Tests", () => {
    it("should enforce max supply in FCFS phase", async () => {
      // Add FCFS phase with limited supply
      await addPhase(
        PhaseType.FCFS,
        "0.15",
        100,
        500,
        2, // maxSupply of 2
        5 // maxPerWallet of 5
      );

      // Advance to phase start
      await advanceTimeAndBlock(110);

      // Get phase index
      const [phaseIndex] = await contract.getActivePhase();

      // Mint first token
      await mintTokenInPhase(
        minter,
        "1",
        "ipfs://fcfs1",
        "0.15",
        Number(phaseIndex)
      );

      // Mint second token
      await mintTokenInPhase(
        otherUser,
        "2",
        "ipfs://fcfs2",
        "0.15",
        Number(phaseIndex)
      );

      // Try to mint third token - should fail due to max supply
      const signatureTimestamp = currentTimestamp + 5;
      const { signature, uniqueId, timestamp } = await signMintRequest(
        minter.address,
        "3",
        "ipfs://fcfs3",
        "0.15",
        Number(phaseIndex),
        signatureTimestamp
      );

      // Advance time for the mint attempt
      await advanceTimeAndBlock(10);

      // This should fail due to max supply limit
      await expect(
        contract
          .connect(minter)
          .mint("3", "ipfs://fcfs3", uniqueId, timestamp, signature, {
            value: ethers.parseEther("0.15")
          })
      ).to.be.revertedWith("Phase supply limit reached");
    });

    it("should enforce max per wallet in FCFS phase", async () => {
      // Add FCFS phase with limit per wallet
      await addPhase(
        PhaseType.FCFS,
        "0.15",
        100,
        500,
        10, // maxSupply of 10
        2 // maxPerWallet of 2
      );

      // Advance to phase start
      await advanceTimeAndBlock(110);

      // Get phase index
      const [phaseIndex] = await contract.getActivePhase();

      // Mint first token
      await mintTokenInPhase(
        minter,
        "1",
        "ipfs://fcfs1",
        "0.15",
        Number(phaseIndex)
      );

      // Mint second token
      await mintTokenInPhase(
        minter,
        "2",
        "ipfs://fcfs2",
        "0.15",
        Number(phaseIndex)
      );

      // Try to mint third token with same wallet - should fail
      const signatureTimestamp = currentTimestamp + 5;
      const { signature, uniqueId, timestamp } = await signMintRequest(
        minter.address,
        "3",
        "ipfs://fcfs3",
        "0.15",
        Number(phaseIndex),
        signatureTimestamp
      );

      // Advance time for the mint attempt
      await advanceTimeAndBlock(10);

      // This should fail due to max per wallet limit
      await expect(
        contract
          .connect(minter)
          .mint("3", "ipfs://fcfs3", uniqueId, timestamp, signature, {
            value: ethers.parseEther("0.15")
          })
      ).to.be.revertedWith("Wallet limit reached for this phase");

      // But another wallet should be able to mint
      await mintTokenInPhase(
        otherUser,
        "3",
        "ipfs://fcfs3",
        "0.15",
        Number(phaseIndex)
      );
    });
  });

  describe("Indefinite Phase Support", () => {
    it("should support a phase with no end time (indefinite duration)", async () => {
      // Add phase with indefinite duration (endTime = 0)
      await contract.connect(owner).addPhase(
        PhaseType.PUBLIC, // PUBLIC
        ethers.parseEther("0.1"),
        BigInt(currentTimestamp + 100), // Start soon
        BigInt(0), // No end time (indefinite)
        10, // maxSupply
        5 // maxPerWallet
      );

      // Advance time to phase start
      await advanceTimeAndBlock(110);

      // Verify phase is active
      const [phaseIndex, phase] = await contract.getActivePhase();
      expect(phase.phaseType).to.equal(PhaseType.PUBLIC); // PUBLIC
      expect(phase.endTime).to.equal(0); // Confirm indefinite

      // Mint a token
      await mintTokenInPhase(
        minter,
        "1",
        "ipfs://indefinite",
        "0.1",
        Number(phaseIndex)
      );

      // Fast forward a long time (e.g., 1 year)
      const oneYear = 365 * 24 * 60 * 60;
      await advanceTimeAndBlock(oneYear);

      // Verify phase is still active
      const [laterPhaseIndex, laterPhase] = await contract.getActivePhase();
      expect(laterPhase.phaseType).to.equal(PhaseType.PUBLIC); // Still PUBLIC

      // Mint another token after a long time
      await mintTokenInPhase(
        otherUser,
        "2",
        "ipfs://indefiniteLater",
        "0.1",
        Number(laterPhaseIndex)
      );

      // Verify both tokens
      expect(await contract.ownerOf("1")).to.equal(minter.address);
      expect(await contract.ownerOf("2")).to.equal(otherUser.address);
    });
  });

  describe("Unlimited Supply Support", () => {
    it("should handle phase with zero maxSupply correctly (unlimited supply)", async () => {
      // Add phase with unlimited supply
      const { phaseStart } = await addPhase(
        PhaseType.PUBLIC, // PUBLIC
        "0.1", // price
        100, // start in 100 seconds
        1000, // duration 1000 seconds
        0, // unlimited supply
        10 // max per wallet
      );

      // Advance to phase start
      await advanceTimeAndBlock(110);

      // Get phase index
      const [phaseIndex] = await contract.getActivePhase();

      // Mint multiple tokens
      for (let i = 1; i <= 5; i++) {
        const tokenId = i.toString();
        const uri = `ipfs://unlimited${i}`;
        const user = i % 2 === 0 ? minter : otherUser;

        await mintTokenInPhase(user, tokenId, uri, "0.1", Number(phaseIndex));
      }

      // Verify tokens
      for (let i = 1; i <= 5; i++) {
        const expectedOwner = i % 2 === 0 ? minter.address : otherUser.address;
        expect(await contract.ownerOf(i.toString())).to.equal(expectedOwner);
      }
    });
  });

  describe("Unlimited Mints Per Wallet", () => {
    it("should support unlimited mints per wallet when maxPerWallet is zero", async () => {
      // Add phase with unlimited mints per wallet
      await addPhase(
        PhaseType.PUBLIC, // PUBLIC
        "0.1", // price
        100, // start in 100 seconds
        1000, // duration 1000 seconds
        20, // max supply
        0 // unlimited mints per wallet
      );

      // Advance to phase start
      await advanceTimeAndBlock(110);

      // Get phase index
      const [phaseIndex] = await contract.getActivePhase();

      // Mint multiple tokens with same wallet
      for (let i = 1; i <= 5; i++) {
        await mintTokenInPhase(
          minter,
          i.toString(),
          `ipfs://unlimited${i}`,
          "0.1",
          Number(phaseIndex)
        );
      }

      // Verify all tokens were minted by same user
      for (let i = 1; i <= 5; i++) {
        expect(await contract.ownerOf(i.toString())).to.equal(minter.address);
      }
    });
  });

  describe("ERC2981 Royalty Standard Tests", () => {
    it("should correctly calculate royalty info", async () => {
      // Add a phase
      await addPhase(
        PhaseType.PUBLIC, // PUBLIC
        "0.5", // price
        100, // start in 100 seconds
        1000 // duration 1000 seconds
      );

      // Advance to phase start
      await advanceTimeAndBlock(110);

      // Get phase index
      const [phaseIndex] = await contract.getActivePhase();

      // Mint a token
      await mintTokenInPhase(
        minter,
        "1",
        "ipfs://royalty",
        "0.5",
        Number(phaseIndex)
      );

      // Set sale price for royalty calculation
      const salePrice = ethers.parseEther("10"); // 10 ETH

      // Get royalty info
      const [receiver, royaltyAmount] = await contract.royaltyInfo(
        "1",
        salePrice
      );

      // Calculate expected royalty
      const expectedRoyalty =
        (salePrice * BigInt(INITIAL_ROYALTY_FEE)) / BigInt(10000);

      // Verify royalty
      expect(receiver).to.equal(owner.address);
      expect(royaltyAmount).to.equal(expectedRoyalty);
    });
  });

  describe("Error Handling", () => {
    it("should revert with reason string when wrong signer is used", async () => {
      // Add phase
      await addPhase(
        PhaseType.PUBLIC, // PUBLIC
        "0.1", // price
        100, // start in 100 seconds
        1000 // duration 1000 seconds
      );

      // Advance to phase start
      await advanceTimeAndBlock(110);

      // Get phase index
      const [phaseIndex] = await contract.getActivePhase();

      // Generate signature using the wrong signer (otherUser instead of backendSigner)
      const tokenId = "1";
      const uri = "ipfs://wrongSigner";
      const signatureTimestamp = currentTimestamp + 5;

      // Create the domain and data just like in the correct signature
      const domain = {
        name: "UnifiedNFT",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await contract.getAddress()
      };

      const uniqueId = ethers.keccak256(
        ethers.solidityPacked(
          ["address", "uint256", "string", "uint256"],
          [minter.address, tokenId, uri, signatureTimestamp]
        )
      );

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
        tokenId: tokenId,
        uri: uri,
        price: ethers.parseEther("0.1"),
        phaseIndex: Number(phaseIndex),
        uniqueId: uniqueId,
        timestamp: signatureTimestamp
      };

      // Sign with wrong signer
      const invalidSignature = await otherUser.signTypedData(
        domain,
        types,
        value
      );

      // Advance time to match signature timestamp
      await advanceTimeAndBlock(10);

      // Attempt to mint with invalid signature
      await expect(
        contract
          .connect(minter)
          .mint(tokenId, uri, uniqueId, signatureTimestamp, invalidSignature, {
            value: ethers.parseEther("0.1")
          })
      ).to.be.revertedWith("Invalid signature");
    });
  });

  describe("Edge Cases", () => {
    it("should revert when attempting to mint during a gap between phases", async () => {
      // Add two phases with a gap between them
      const { phaseEnd: phase1End } = await addPhase(
        PhaseType.WHITELIST, // WHITELIST
        "0.1", // price
        100, // start in 100 seconds
        500 // duration 500 seconds
      );

      const { phaseStart: phase2Start } = await addPhase(
        PhaseType.PUBLIC, // PUBLIC
        "0.2", // price
        700, // start with 100s gap after phase1
        500 // duration 500 seconds
      );

      // Advance time to the gap between phases
      await advanceTimeAndBlock(110); // Go to phase 1
      await advanceTimeAndBlock(500); // Now we should be in the gap

      // Attempt to get active phase
      await expect(contract.getActivePhase()).to.be.revertedWith(
        "No active phase"
      );

      // Try to mint during the gap - this should fail
      // We'll generate a signature but it will fail at the contract level
      const tokenId = "1";
      const uri = "ipfs://gapMint";
      const signatureTimestamp = currentTimestamp + 5;

      // Create signature with a fake phaseIndex (0)
      const { signature, uniqueId } = await signMintRequest(
        minter.address,
        tokenId,
        uri,
        "0.1",
        0, // Using 0 as there's no active phase
        signatureTimestamp
      );

      // Advance time a bit for the mint attempt
      await advanceTimeAndBlock(10);

      // Attempt to mint during gap should fail
      await expect(
        contract
          .connect(minter)
          .mint(tokenId, uri, uniqueId, signatureTimestamp, signature, {
            value: ethers.parseEther("0.1")
          })
      ).to.be.revertedWith("No active phase");
    });
  });

  describe("Interoperability Tests", () => {
    it("should correctly support ERC721Enumerable functionality", async () => {
      // Add phase
      await addPhase(
        PhaseType.PUBLIC, // PUBLIC
        "0.1", // price
        100, // start in 100 seconds
        1000 // duration 1000 seconds
      );

      // Advance to phase start
      await advanceTimeAndBlock(110);

      // Get phase index
      const [phaseIndex] = await contract.getActivePhase();

      // Mint several tokens
      const numTokens = 3;
      for (let i = 1; i <= numTokens; i++) {
        await mintTokenInPhase(
          minter,
          i.toString(),
          `ipfs://enum${i}`,
          "0.1",
          Number(phaseIndex)
        );
      }

      // Test totalSupply
      expect(await contract.totalSupply()).to.equal(numTokens);

      // Test tokenByIndex
      for (let i = 0; i < numTokens; i++) {
        const tokenId = await contract.tokenByIndex(i);
        expect(tokenId).to.be.greaterThan(0);
      }

      // Test tokenOfOwnerByIndex
      for (let i = 0; i < numTokens; i++) {
        const tokenId = await contract.tokenOfOwnerByIndex(minter.address, i);
        expect(tokenId).to.be.greaterThan(0);
      }

      // Verify balanceOf
      expect(await contract.balanceOf(minter.address)).to.equal(numTokens);
    });
  });

  describe("Phase Update Tests", () => {
    it("should correctly update a WHITELIST phase", async () => {
      // Add initial whitelist phase
      const initialPrice = "0.1";
      const initialMaxSupply = 10;
      const initialMaxPerWallet = 2;

      await addPhase(
        PhaseType.WHITELIST,
        initialPrice,
        100, // start in 100 seconds
        500, // duration 500 seconds
        initialMaxSupply,
        initialMaxPerWallet
      );

      // Get the phase before update
      const phaseIndex = 0; // First phase
      const phaseBefore = await contract.phases(phaseIndex);

      // Update the phase
      const newPrice = "0.15";
      const newStartOffset = 200;
      const newDuration = 600;
      const newMaxSupply = 15;
      const newMaxPerWallet = 3;

      const newStartTime = currentTimestamp + newStartOffset;
      const newEndTime = newStartTime + newDuration;

      await contract
        .connect(owner)
        .updatePhase(
          phaseIndex,
          PhaseType.WHITELIST,
          ethers.parseEther(newPrice),
          BigInt(newStartTime),
          BigInt(newEndTime),
          newMaxSupply,
          newMaxPerWallet
        );

      // Get the phase after update
      const phaseAfter = await contract.phases(phaseIndex);

      // Verify changes
      expect(phaseAfter.phaseType).to.equal(PhaseType.WHITELIST);
      expect(phaseAfter.price).to.equal(ethers.parseEther(newPrice));
      expect(phaseAfter.startTime).to.equal(newStartTime);
      expect(phaseAfter.endTime).to.equal(newEndTime);
      expect(phaseAfter.maxSupply).to.equal(newMaxSupply);
      expect(phaseAfter.maxPerWallet).to.equal(newMaxPerWallet);

      // Advance time to the updated phase start
      await advanceTimeAndBlock(newStartOffset);

      // Verify we can mint with new price
      const [activePhaseIndex] = await contract.getActivePhase();
      await mintTokenInPhase(
        minter,
        "1",
        "ipfs://updated-whitelist",
        newPrice,
        Number(activePhaseIndex)
      );

      // Verify ownership
      expect(await contract.ownerOf("1")).to.equal(minter.address);
    });

    it("should correctly update an FCFS phase", async () => {
      // Add initial FCFS phase
      const initialPrice = "0.2";
      const initialMaxSupply = 20;
      const initialMaxPerWallet = 3;

      await addPhase(
        PhaseType.FCFS,
        initialPrice,
        100, // start in 100 seconds
        500, // duration 500 seconds
        initialMaxSupply,
        initialMaxPerWallet
      );

      // Get the phase before update
      const phaseIndex = 0; // First phase
      const phaseBefore = await contract.phases(phaseIndex);

      // Update the phase
      const newPrice = "0.25";
      const newStartOffset = 200;
      const newDuration = 700;
      const newMaxSupply = 25;
      const newMaxPerWallet = 5;

      const newStartTime = currentTimestamp + newStartOffset;
      const newEndTime = newStartTime + newDuration;

      await contract
        .connect(owner)
        .updatePhase(
          phaseIndex,
          PhaseType.FCFS,
          ethers.parseEther(newPrice),
          BigInt(newStartTime),
          BigInt(newEndTime),
          newMaxSupply,
          newMaxPerWallet
        );

      // Get the phase after update
      const phaseAfter = await contract.phases(phaseIndex);

      // Verify changes
      expect(phaseAfter.phaseType).to.equal(PhaseType.FCFS);
      expect(phaseAfter.price).to.equal(ethers.parseEther(newPrice));
      expect(phaseAfter.startTime).to.equal(newStartTime);
      expect(phaseAfter.endTime).to.equal(newEndTime);
      expect(phaseAfter.maxSupply).to.equal(newMaxSupply);
      expect(phaseAfter.maxPerWallet).to.equal(newMaxPerWallet);

      // Advance time to the updated phase start
      await advanceTimeAndBlock(newStartOffset);

      // Verify we can mint with new price
      const [activePhaseIndex] = await contract.getActivePhase();
      await mintTokenInPhase(
        minter,
        "1",
        "ipfs://updated-fcfs",
        newPrice,
        Number(activePhaseIndex)
      );

      // Verify ownership
      expect(await contract.ownerOf("1")).to.equal(minter.address);

      // Verify the wallet minting limit
      for (let i = 2; i <= newMaxPerWallet; i++) {
        await mintTokenInPhase(
          minter,
          i.toString(),
          `ipfs://updated-fcfs-${i}`,
          newPrice,
          Number(activePhaseIndex)
        );
      }

      // Attempt to mint beyond the new wallet limit
      const signatureTimestamp = currentTimestamp + 5;
      const { signature, uniqueId, timestamp } = await signMintRequest(
        minter.address,
        (newMaxPerWallet + 1).toString(),
        "ipfs://updated-fcfs-beyond-limit",
        newPrice,
        Number(activePhaseIndex),
        signatureTimestamp
      );

      await advanceTimeAndBlock(10);

      // This should fail due to the new wallet limit
      await expect(
        contract
          .connect(minter)
          .mint(
            (newMaxPerWallet + 1).toString(),
            "ipfs://updated-fcfs-beyond-limit",
            uniqueId,
            timestamp,
            signature,
            { value: ethers.parseEther(newPrice) }
          )
      ).to.be.revertedWith("Wallet limit reached for this phase");
    });

    it("should correctly update a PUBLIC phase", async () => {
      // Add initial PUBLIC phase
      const initialPrice = "0.3";
      const initialMaxSupply = 0; // unlimited
      const initialMaxPerWallet = 0; // unlimited

      await addPhase(
        PhaseType.PUBLIC,
        initialPrice,
        100, // start in 100 seconds
        500, // duration 500 seconds
        initialMaxSupply,
        initialMaxPerWallet
      );

      // Get the phase before update
      const phaseIndex = 0; // First phase
      const phaseBefore = await contract.phases(phaseIndex);

      // Update the phase
      const newPrice = "0.35";
      const newStartOffset = 200;
      const newDuration = 800;
      const newMaxSupply = 50; // now limited
      const newMaxPerWallet = 10; // now limited

      const newStartTime = currentTimestamp + newStartOffset;
      const newEndTime = newStartTime + newDuration;

      await contract
        .connect(owner)
        .updatePhase(
          phaseIndex,
          PhaseType.PUBLIC,
          ethers.parseEther(newPrice),
          BigInt(newStartTime),
          BigInt(newEndTime),
          newMaxSupply,
          newMaxPerWallet
        );

      // Get the phase after update
      const phaseAfter = await contract.phases(phaseIndex);

      // Verify changes
      expect(phaseAfter.phaseType).to.equal(PhaseType.PUBLIC);
      expect(phaseAfter.price).to.equal(ethers.parseEther(newPrice));
      expect(phaseAfter.startTime).to.equal(newStartTime);
      expect(phaseAfter.endTime).to.equal(newEndTime);
      expect(phaseAfter.maxSupply).to.equal(newMaxSupply);
      expect(phaseAfter.maxPerWallet).to.equal(newMaxPerWallet);

      // Advance time to the updated phase start
      await advanceTimeAndBlock(newStartOffset);

      // Verify we can mint with new price
      const [activePhaseIndex] = await contract.getActivePhase();
      await mintTokenInPhase(
        minter,
        "1",
        "ipfs://updated-public",
        newPrice,
        Number(activePhaseIndex)
      );

      // Verify ownership
      expect(await contract.ownerOf("1")).to.equal(minter.address);
    });

    it("should handle changing a phase type during update", async () => {
      // Add initial WHITELIST phase
      const initialPrice = "0.1";
      await addPhase(
        PhaseType.WHITELIST,
        initialPrice,
        100, // start in 100 seconds
        500, // duration 500 seconds
        10, // maxSupply
        2 // maxPerWallet
      );

      // Get the phase before update
      const phaseIndex = 0; // First phase
      const phaseBefore = await contract.phases(phaseIndex);
      expect(phaseBefore.phaseType).to.equal(PhaseType.WHITELIST);

      // Update the phase type to PUBLIC
      const newPrice = "0.2";
      const newStartOffset = 200;
      const newDuration = 600;

      const newStartTime = currentTimestamp + newStartOffset;
      const newEndTime = newStartTime + newDuration;

      await contract.connect(owner).updatePhase(
        phaseIndex,
        PhaseType.PUBLIC, // Changed from WHITELIST to PUBLIC
        ethers.parseEther(newPrice),
        BigInt(newStartTime),
        BigInt(newEndTime),
        0, // unlimited supply for public
        0 // unlimited per wallet for public
      );

      // Get the phase after update
      const phaseAfter = await contract.phases(phaseIndex);

      // Verify the phase type changed
      expect(phaseAfter.phaseType).to.equal(PhaseType.PUBLIC);

      // Advance time to the updated phase start
      await advanceTimeAndBlock(newStartOffset);

      // Verify we can mint with new price under PUBLIC phase rules
      const [activePhaseIndex] = await contract.getActivePhase();

      // Should be able to mint multiple tokens without per-wallet limit
      for (let i = 1; i <= 5; i++) {
        await mintTokenInPhase(
          minter,
          i.toString(),
          `ipfs://changed-type-${i}`,
          newPrice,
          Number(activePhaseIndex)
        );
      }

      // Verify all tokens were minted
      for (let i = 1; i <= 5; i++) {
        expect(await contract.ownerOf(i.toString())).to.equal(minter.address);
      }
    });

    it("should prevent overlapping phases when updating", async () => {
      // Add first phase
      await addPhase(
        PhaseType.WHITELIST,
        "0.1",
        100, // start in 100 seconds
        500 // duration 500 seconds
      );

      // Add second phase after first
      await addPhase(
        PhaseType.PUBLIC,
        "0.2",
        700, // starts 100s after first phase ends
        500 // duration 500 seconds
      );

      // Try to update first phase to overlap with second
      const phaseIndex = 0;
      const newStartOffset = 100;
      const newDuration = 700; // This would overlap with second phase

      const newStartTime = currentTimestamp + newStartOffset;
      const newEndTime = newStartTime + newDuration;

      // Update should be rejected
      await expect(
        contract
          .connect(owner)
          .updatePhase(
            phaseIndex,
            PhaseType.WHITELIST,
            ethers.parseEther("0.15"),
            BigInt(newStartTime),
            BigInt(newEndTime),
            10,
            2
          )
      ).to.be.revertedWith("Phase time overlaps with existing phase");
    });

    it("should enforce valid max per wallet values for non-public phases", async () => {
      // Add initial phase
      await addPhase(PhaseType.WHITELIST, "0.1", 100, 500, 10, 2);

      // Try to update to invalid values
      const phaseIndex = 0;
      const newStartOffset = 200;
      const newDuration = 600;

      const newStartTime = currentTimestamp + newStartOffset;
      const newEndTime = newStartTime + newDuration;

      // Should reject maxPerWallet = 0 for WHITELIST
      await expect(
        contract.connect(owner).updatePhase(
          phaseIndex,
          PhaseType.WHITELIST,
          ethers.parseEther("0.15"),
          BigInt(newStartTime),
          BigInt(newEndTime),
          10,
          0 // Invalid for WHITELIST
        )
      ).to.be.revertedWith("Invalid max per wallet for non-public phase");

      // Should also reject for FCFS
      await expect(
        contract.connect(owner).updatePhase(
          phaseIndex,
          PhaseType.FCFS,
          ethers.parseEther("0.15"),
          BigInt(newStartTime),
          BigInt(newEndTime),
          10,
          0 // Invalid for FCFS
        )
      ).to.be.revertedWith("Invalid max per wallet for non-public phase");

      // But should accept for PUBLIC
      await contract.connect(owner).updatePhase(
        phaseIndex,
        PhaseType.PUBLIC,
        ethers.parseEther("0.15"),
        BigInt(newStartTime),
        BigInt(newEndTime),
        10,
        0 // Valid for PUBLIC
      );

      const phaseAfter = await contract.phases(phaseIndex);
      expect(phaseAfter.phaseType).to.equal(PhaseType.PUBLIC);
      expect(phaseAfter.maxPerWallet).to.equal(0);
    });

    it("should validate phase index when updating", async () => {
      // Try to update a non-existent phase
      const invalidPhaseIndex = 99; // Assuming we don't have 100 phases

      await expect(
        contract
          .connect(owner)
          .updatePhase(
            invalidPhaseIndex,
            PhaseType.PUBLIC,
            ethers.parseEther("0.15"),
            BigInt(currentTimestamp + 100),
            BigInt(currentTimestamp + 600),
            10,
            5
          )
      ).to.be.revertedWith("Invalid phase index");
    });

    it("should only allow owner to update phases", async () => {
      // Add a phase first
      await addPhase(PhaseType.PUBLIC, "0.1", 100, 500);

      // Non-owner tries to update
      const phaseIndex = 0;

      await expect(
        contract.connect(minter).updatePhase(
          // minter is not owner
          phaseIndex,
          PhaseType.PUBLIC,
          ethers.parseEther("0.15"),
          BigInt(currentTimestamp + 100),
          BigInt(currentTimestamp + 600),
          10,
          5
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Complete Phase Update Test", () => {
    it("should correctly update all parameters of each phase when all phases are set", async () => {
      // ==================== SETUP INITIAL PHASES ====================
      // Set up all three phases with clear spacing between them

      // Define initial time slots with gaps between phases
      const initialPhase1Start = currentTimestamp + 100;
      const initialPhase1End = initialPhase1Start + 300;

      const initialPhase2Start = initialPhase1End + 100; // Gap after phase 1
      const initialPhase2End = initialPhase2Start + 300;

      const initialPhase3Start = initialPhase2End + 100; // Gap after phase 2
      const initialPhase3End = initialPhase3Start + 300;

      // Set initial prices, maxSupply, and maxPerWallet
      const initialWhitelistPrice = "0.1";
      const initialFcfsPrice = "0.15";
      const initialPublicPrice = "0.2";

      // Add WHITELIST phase
      await contract.connect(owner).addPhase(
        PhaseType.WHITELIST,
        ethers.parseEther(initialWhitelistPrice),
        BigInt(initialPhase1Start),
        BigInt(initialPhase1End),
        10, // maxSupply
        2 // maxPerWallet
      );

      // Add FCFS phase
      await contract.connect(owner).addPhase(
        PhaseType.FCFS,
        ethers.parseEther(initialFcfsPrice),
        BigInt(initialPhase2Start),
        BigInt(initialPhase2End),
        20, // maxSupply
        3 // maxPerWallet
      );

      // Add PUBLIC phase
      await contract.connect(owner).addPhase(
        PhaseType.PUBLIC,
        ethers.parseEther(initialPublicPrice),
        BigInt(initialPhase3Start),
        BigInt(initialPhase3End),
        0, // unlimited supply
        0 // unlimited per wallet
      );

      // Verify initial phase setup
      expect(await contract.getPhaseCount()).to.equal(3);

      // ==================== UPDATE WHITELIST PHASE (ALL PARAMETERS) ====================
      // Define new parameters for WHITELIST phase
      const newWhitelistPrice = "0.12";
      const newWhitelistMaxSupply = 15;
      const newWhitelistMaxPerWallet = 3;

      // Define new time slots with DIFFERENT timing but still no overlap
      const newPhase1Start = initialPhase1Start + 50; // Start 50s later
      const newPhase1End = initialPhase1End - 50; // End 50s earlier

      // Update WHITELIST phase with all new parameters
      await contract.connect(owner).updatePhase(
        0, // WHITELIST phase index
        PhaseType.WHITELIST, // Same type
        ethers.parseEther(newWhitelistPrice),
        BigInt(newPhase1Start),
        BigInt(newPhase1End),
        newWhitelistMaxSupply,
        newWhitelistMaxPerWallet
      );

      // Verify WHITELIST phase updates
      const updatedPhase0 = await contract.phases(0);
      expect(updatedPhase0.price).to.equal(
        ethers.parseEther(newWhitelistPrice)
      );
      expect(updatedPhase0.startTime).to.equal(BigInt(newPhase1Start));
      expect(updatedPhase0.endTime).to.equal(BigInt(newPhase1End));
      expect(updatedPhase0.maxSupply).to.equal(newWhitelistMaxSupply);
      expect(updatedPhase0.maxPerWallet).to.equal(newWhitelistMaxPerWallet);

      // ==================== UPDATE FCFS PHASE (ALL PARAMETERS) ====================
      // Define new parameters for FCFS phase
      const newFcfsPrice = "0.18";
      const newFcfsMaxSupply = 25;
      const newFcfsMaxPerWallet = 4;

      // Define new time slots with DIFFERENT timing but still no overlap
      const newPhase2Start = initialPhase2Start + 50; // Start 50s later
      const newPhase2End = initialPhase2End - 50; // End 50s earlier

      // Update FCFS phase with all new parameters
      await contract.connect(owner).updatePhase(
        1, // FCFS phase index
        PhaseType.FCFS, // Same type
        ethers.parseEther(newFcfsPrice),
        BigInt(newPhase2Start),
        BigInt(newPhase2End),
        newFcfsMaxSupply,
        newFcfsMaxPerWallet
      );

      // Verify FCFS phase updates
      const updatedPhase1 = await contract.phases(1);
      expect(updatedPhase1.price).to.equal(ethers.parseEther(newFcfsPrice));
      expect(updatedPhase1.startTime).to.equal(BigInt(newPhase2Start));
      expect(updatedPhase1.endTime).to.equal(BigInt(newPhase2End));
      expect(updatedPhase1.maxSupply).to.equal(newFcfsMaxSupply);
      expect(updatedPhase1.maxPerWallet).to.equal(newFcfsMaxPerWallet);

      // ==================== UPDATE PUBLIC PHASE (ALL PARAMETERS) ====================
      // Define new parameters for PUBLIC phase
      const newPublicPrice = "0.25";
      const newPublicMaxSupply = 50; // Set a limit
      const newPublicMaxPerWallet = 10; // Set a limit

      // Define new time slots with DIFFERENT timing but still no overlap
      const newPhase3Start = initialPhase3Start + 50; // Start 50s later
      const newPhase3End = initialPhase3End - 50; // End 50s earlier

      // Update PUBLIC phase with all new parameters
      await contract.connect(owner).updatePhase(
        2, // PUBLIC phase index
        PhaseType.PUBLIC, // Same type
        ethers.parseEther(newPublicPrice),
        BigInt(newPhase3Start),
        BigInt(newPhase3End),
        newPublicMaxSupply,
        newPublicMaxPerWallet
      );

      // Verify PUBLIC phase updates
      const updatedPhase2 = await contract.phases(2);
      expect(updatedPhase2.price).to.equal(ethers.parseEther(newPublicPrice));
      expect(updatedPhase2.startTime).to.equal(BigInt(newPhase3Start));
      expect(updatedPhase2.endTime).to.equal(BigInt(newPhase3End));
      expect(updatedPhase2.maxSupply).to.equal(newPublicMaxSupply);
      expect(updatedPhase2.maxPerWallet).to.equal(newPublicMaxPerWallet);

      // ==================== TEST WHITELIST PHASE - TIMING AND PARAMETERS ====================
      // Advance to updated WHITELIST phase
      await advanceTimeAndBlock(newPhase1Start - currentTimestamp + 10);

      // Get the latest timestamp
      const latestBlock1 = await ethers.provider.getBlock("latest");
      currentTimestamp = Number(latestBlock1!.timestamp);

      // Verify active phase is WHITELIST
      const [whitelistPhaseIndex, whitelistPhase] =
        await contract.getActivePhase();
      expect(whitelistPhase.phaseType).to.equal(PhaseType.WHITELIST);

      // Test all parameters by minting multiple tokens
      // This tests both price and maxPerWallet
      for (let i = 1; i <= newWhitelistMaxPerWallet; i++) {
        await mintTokenInPhase(
          minter,
          i.toString(),
          `ipfs://whitelist-${i}`,
          newWhitelistPrice,
          Number(whitelistPhaseIndex)
        );
      }

      // Verify minted tokens
      for (let i = 1; i <= newWhitelistMaxPerWallet; i++) {
        expect(await contract.ownerOf(i.toString())).to.equal(minter.address);
      }

      // ==================== TEST FCFS PHASE - TIMING AND PARAMETERS ====================
      // Advance to updated FCFS phase
      await advanceTimeAndBlock(newPhase2Start - currentTimestamp + 10);

      // Get the latest timestamp
      const latestBlock2 = await ethers.provider.getBlock("latest");
      currentTimestamp = Number(latestBlock2!.timestamp);

      // Verify active phase is FCFS
      const [fcfsPhaseIndex, fcfsPhase] = await contract.getActivePhase();
      expect(fcfsPhase.phaseType).to.equal(PhaseType.FCFS);

      // Test all parameters by minting multiple tokens
      // Start token ID where whitelist ended
      const fcfsStartId = newWhitelistMaxPerWallet + 1;
      for (let i = 0; i < newFcfsMaxPerWallet; i++) {
        const tokenId = (fcfsStartId + i).toString();
        await mintTokenInPhase(
          minter,
          tokenId,
          `ipfs://fcfs-${tokenId}`,
          newFcfsPrice,
          Number(fcfsPhaseIndex)
        );
      }

      // Verify minted tokens
      for (let i = fcfsStartId; i < fcfsStartId + newFcfsMaxPerWallet; i++) {
        expect(await contract.ownerOf(i.toString())).to.equal(minter.address);
      }

      // ==================== TEST PUBLIC PHASE - TIMING AND PARAMETERS ====================
      // Advance to updated PUBLIC phase
      await advanceTimeAndBlock(newPhase3Start - currentTimestamp + 10);

      // Get the latest timestamp
      const latestBlock3 = await ethers.provider.getBlock("latest");
      currentTimestamp = Number(latestBlock3!.timestamp);

      // Verify active phase is PUBLIC
      const [publicPhaseIndex, publicPhase] = await contract.getActivePhase();
      expect(publicPhase.phaseType).to.equal(PhaseType.PUBLIC);

      // Test all parameters by minting multiple tokens
      // Start token ID where FCFS ended, but limit to just 3 mints for brevity
      const publicStartId = fcfsStartId + newFcfsMaxPerWallet;
      const publicTestMints = 3; // Just mint a few to test

      for (let i = 0; i < publicTestMints; i++) {
        const tokenId = (publicStartId + i).toString();
        await mintTokenInPhase(
          minter,
          tokenId,
          `ipfs://public-${tokenId}`,
          newPublicPrice,
          Number(publicPhaseIndex)
        );
      }

      // Verify minted tokens
      for (let i = publicStartId; i < publicStartId + publicTestMints; i++) {
        expect(await contract.ownerOf(i.toString())).to.equal(minter.address);
      }
    });

    it("should reject updates that would cause phase overlap", async () => {
      // ==================== SETUP INITIAL PHASES ====================
      // Set up phases with minimal gaps
      const initialPhase1Start = currentTimestamp + 100;
      const initialPhase1End = initialPhase1Start + 300;

      const initialPhase2Start = initialPhase1End + 10; // Small gap
      const initialPhase2End = initialPhase2Start + 300;

      // Add two phases
      await contract
        .connect(owner)
        .addPhase(
          PhaseType.WHITELIST,
          ethers.parseEther("0.1"),
          BigInt(initialPhase1Start),
          BigInt(initialPhase1End),
          10,
          2
        );

      await contract
        .connect(owner)
        .addPhase(
          PhaseType.FCFS,
          ethers.parseEther("0.15"),
          BigInt(initialPhase2Start),
          BigInt(initialPhase2End),
          20,
          3
        );

      // Try to update the first phase to overlap with the second
      const newPhase1End = initialPhase1End + 20; // This would overlap

      await expect(
        contract.connect(owner).updatePhase(
          0, // First phase
          PhaseType.WHITELIST,
          ethers.parseEther("0.12"),
          BigInt(initialPhase1Start),
          BigInt(newPhase1End), // This end time overlaps with phase 2
          15,
          3
        )
      ).to.be.revertedWith("Phase time overlaps with existing phase");

      // Try to update the second phase to overlap with the first
      const newPhase2Start = initialPhase2Start - 20; // This would overlap

      await expect(
        contract.connect(owner).updatePhase(
          1, // Second phase
          PhaseType.FCFS,
          ethers.parseEther("0.18"),
          BigInt(newPhase2Start), // This start time overlaps with phase 1
          BigInt(initialPhase2End),
          25,
          4
        )
      ).to.be.revertedWith("Phase time overlaps with existing phase");
    });
  });
});
