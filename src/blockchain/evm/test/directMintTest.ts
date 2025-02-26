import { expect } from "chai";
import { ethers } from "hardhat";
import { LaunchNFTV2 } from "../typechain-types";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("LaunchNFTV2 Extended Tests", () => {
  let contract: LaunchNFTV2;
  let owner: SignerWithAddress;
  let backendSigner: SignerWithAddress;
  let platformFeeRecipient: SignerWithAddress;
  let minter: SignerWithAddress;
  let otherUser: SignerWithAddress;
  let globalTimestamp: number;
  let currentTimestamp: number; // Track the current timestamp to avoid conflicts

  const INITIAL_ROYALTY_FEE = 500; // 5%
  const INITIAL_PLATFORM_FEE = 250; // 2.5%
  const CONTRACT_NAME = "Test NFT";
  const CONTRACT_SYMBOL = "TNFT";

  // Setup and helper functions
  before(async () => {
    await ethers.provider.send("hardhat_reset", [
      {
        allowBlocksWithSameTimestamp: true
      }
    ]);
    const latestBlock = await ethers.provider.getBlock("latest");
    globalTimestamp = Number(latestBlock!.timestamp);
    currentTimestamp = globalTimestamp;
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
  }

  async function generateSignature(
    minterAddress: string,
    tokenId: string,
    uri: string,
    price: string,
    phaseIndex: number,
    customTimestamp?: number
  ) {
    const domain = {
      name: "UnifiedNFT",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await contract.getAddress()
    };

    // Create unique identifier that's consistent for tests
    const uniqueIdBase = Date.now() + parseInt(tokenId);
    const uniqueId = ethers.keccak256(
      ethers.solidityPacked(
        ["address", "uint256", "string", "uint256"],
        [minterAddress, tokenId, uri, uniqueIdBase]
      )
    );

    // Use provided timestamp or increment current timestamp
    if (!customTimestamp) {
      // Increment timestamp to ensure it's always moving forward
      currentTimestamp += 10;
    }
    const timestamp = customTimestamp || currentTimestamp;

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
    currentTimestamp = globalTimestamp;
  });

  describe("Phase Transitions", () => {
    it("should correctly transition from whitelist to public phase", async () => {
      // Set up whitelist phase
      const { root: whitelistRoot, proof: whitelistProof } = createMerkleProof([
        minter.address
      ]);

      const whitelistStart = globalTimestamp + 100;
      const whitelistEnd = whitelistStart + 1000;
      const publicStart = whitelistEnd + 100;
      const publicEnd = publicStart + 1000;

      // Add whitelist phase
      await contract.connect(owner).addPhase(
        1, // WHITELIST
        ethers.parseEther("0.1"),
        BigInt(whitelistStart),
        BigInt(whitelistEnd),
        10, // maxSupply
        5, // maxPerWallet - increased to avoid "Wallet limit" error
        whitelistRoot
      );

      // Add public phase
      await contract.connect(owner).addPhase(
        2, // PUBLIC
        ethers.parseEther("0.2"),
        BigInt(publicStart),
        BigInt(publicEnd),
        20, // maxSupply
        5, // wallet limit for public phase
        ethers.ZeroHash
      );

      // Fast forward to whitelist phase
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        whitelistStart + 10
      ]);
      await mineBlock();

      // Get active phase (verify we're in whitelist phase)
      let [phaseIndex, phase] = await contract.getActivePhase();
      expect(phase.phaseType).to.equal(1); // WHITELIST

      // Mint during whitelist phase
      const tokenId = "1";
      const uri = "ipfs://testWhitelist";
      const { signature, uniqueId, timestamp } = await generateSignature(
        minter.address,
        tokenId,
        uri,
        "0.1",
        Number(phaseIndex)
      );

      // Use exact timestamp from signature
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mineBlock();

      await contract
        .connect(minter)
        .mint(tokenId, uri, uniqueId, timestamp, signature, whitelistProof, {
          value: ethers.parseEther("0.1")
        });

      // Fast forward to public phase
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        publicStart + 10
      ]);
      await mineBlock();

      // Get active phase (verify we're in public phase)
      [phaseIndex, phase] = await contract.getActivePhase();
      expect(phase.phaseType).to.equal(2); // PUBLIC

      // Mint during public phase
      const tokenId2 = "2";
      const uri2 = "ipfs://testPublic";
      const {
        signature: publicSignature,
        uniqueId: publicUniqueId,
        timestamp: publicTimestamp
      } = await generateSignature(
        otherUser.address,
        tokenId2,
        uri2,
        "0.2",
        Number(phaseIndex)
      );

      // Use exact timestamp from signature
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        publicTimestamp
      ]);
      await mineBlock();

      await contract.connect(otherUser).mint(
        tokenId2,
        uri2,
        publicUniqueId,
        publicTimestamp,
        publicSignature,
        [], // Empty proof for public phase
        { value: ethers.parseEther("0.2") }
      );

      // Verify both tokens were minted correctly
      expect(await contract.ownerOf(tokenId)).to.equal(minter.address);
      expect(await contract.ownerOf(tokenId2)).to.equal(otherUser.address);
    });
  });

  describe("ERC2981 Royalty Standard Tests", () => {
    it("should correctly calculate royalty info", async () => {
      // Add a public phase
      await contract.connect(owner).addPhase(
        2, // PUBLIC
        ethers.parseEther("0.5"),
        BigInt(globalTimestamp),
        BigInt(globalTimestamp + 86400),
        100, // maxSupply
        5, // maxPerWallet
        ethers.ZeroHash // No merkle root needed for public
      );

      // Move to phase
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        globalTimestamp + 10
      ]);
      await mineBlock();

      // Get active phase index for signature
      const [phaseIndex] = await contract.getActivePhase();

      // Mint a token first
      const tokenId = "1";
      const uri = "ipfs://testRoyalty";
      const { signature, uniqueId, timestamp } = await generateSignature(
        minter.address,
        tokenId,
        uri,
        "0.5",
        Number(phaseIndex) // Use correct phase index
      );

      // Use exact timestamp from signature
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mineBlock();

      await contract.connect(minter).mint(
        tokenId,
        uri,
        uniqueId,
        timestamp,
        signature,
        [], // Empty proof for public
        { value: ethers.parseEther("0.5") }
      );

      // Set sale price for royalty calculation
      const salePrice = ethers.parseEther("10"); // 10 ETH

      // Get royalty info for token
      const [receiver, royaltyAmount] = await contract.royaltyInfo(
        tokenId,
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
      // Setup phase
      await contract.connect(owner).addPhase(
        2, // PUBLIC
        ethers.parseEther("0.1"),
        BigInt(globalTimestamp),
        BigInt(globalTimestamp + 86400),
        100,
        10,
        ethers.ZeroHash
      );

      await ethers.provider.send("evm_setNextBlockTimestamp", [
        globalTimestamp + 10
      ]);
      await mineBlock();

      // Setup a different signer
      const wrongSigner = otherUser; // Using otherUser as wrong signer

      // Generate domain and data
      const domain = {
        name: "UnifiedNFT",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await contract.getAddress()
      };

      const tokenId = "1";
      const uri = "ipfs://test";
      const uniqueId = ethers.keccak256(
        ethers.solidityPacked(
          ["address", "uint256", "string", "uint256"],
          [minter.address, tokenId, uri, Date.now()]
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
        minter: minter.address,
        tokenId: tokenId,
        uri: uri,
        price: ethers.parseEther("0.1"),
        phaseIndex: 1, // First active phase
        uniqueId: uniqueId,
        timestamp: timestamp
      };

      // Sign with wrong signer
      const invalidSignature = await wrongSigner.signTypedData(
        domain,
        types,
        value
      );

      // Set blockchain time to match timestamp
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mineBlock();

      // Attempt to mint with invalid signature - using revertedWith instead of revertedWithCustomError
      await expect(
        contract
          .connect(minter)
          .mint(tokenId, uri, uniqueId, timestamp, invalidSignature, [], {
            value: ethers.parseEther("0.1")
          })
      ).to.be.revertedWith("Invalid signature");
    });
  });

  describe("Edge Cases", () => {
    it("should handle phase with zero maxSupply correctly (unlimited supply)", async () => {
      // Add a phase with unlimited supply (maxSupply = 0)
      await contract.connect(owner).addPhase(
        2, // PUBLIC
        ethers.parseEther("0.1"),
        BigInt(globalTimestamp),
        BigInt(globalTimestamp + 86400),
        0, // Unlimited supply
        10, // maxPerWallet - increased to handle multiple mints
        ethers.ZeroHash
      );

      await ethers.provider.send("evm_setNextBlockTimestamp", [
        globalTimestamp + 10
      ]);
      await mineBlock();

      const [phaseIndex] = await contract.getActivePhase();

      // Mint multiple tokens (limiting to 5 for test speed)
      for (let i = 1; i <= 5; i++) {
        const tokenId = i.toString();
        const uri = `ipfs://unlimited${i}`;

        // Mint with the current user
        const currentUser = i % 2 === 0 ? minter : otherUser;

        const { signature, uniqueId, timestamp } = await generateSignature(
          currentUser.address,
          tokenId,
          uri,
          "0.1",
          Number(phaseIndex)
        );

        // Set blockchain time to match each signature timestamp, ensuring we advance forward
        await ethers.provider.send("evm_setNextBlockTimestamp", [
          timestamp + i
        ]);
        await mineBlock();

        await contract
          .connect(currentUser)
          .mint(tokenId, uri, uniqueId, timestamp, signature, [], {
            value: ethers.parseEther("0.1")
          });
      }

      // Verify tokens were minted
      for (let i = 1; i <= 5; i++) {
        const expectedOwner = i % 2 === 0 ? minter.address : otherUser.address;
        expect(await contract.ownerOf(i.toString())).to.equal(expectedOwner);
      }
    });

    it("should revert when attempting to mint during a gap between phases", async () => {
      const phase1Start = globalTimestamp + 100;
      const phase1End = phase1Start + 1000;
      const phase2Start = phase1End + 500; // 500 second gap
      const phase2End = phase2Start + 1000;

      // Add two phases with a gap between them
      const { root, proof } = createMerkleProof([minter.address]);

      await contract.connect(owner).addPhase(
        1, // WHITELIST
        ethers.parseEther("0.1"),
        BigInt(phase1Start),
        BigInt(phase1End),
        10,
        2,
        root
      );

      await contract.connect(owner).addPhase(
        2, // PUBLIC
        ethers.parseEther("0.2"),
        BigInt(phase2Start),
        BigInt(phase2End),
        20,
        5,
        ethers.ZeroHash
      );

      // Fast forward to the gap between phases
      const gapTime = phase1End + 100; // Sometime in the gap
      await ethers.provider.send("evm_setNextBlockTimestamp", [gapTime]);
      await mineBlock();

      // Attempt to get active phase - using revertedWith instead of revertedWithCustomError
      await expect(contract.getActivePhase()).to.be.revertedWith(
        "No active phase"
      );

      // Generate signature anyway (using phase index 0)
      const tokenId = "1";
      const uri = "ipfs://testGap";
      const { signature, uniqueId, timestamp } = await generateSignature(
        minter.address,
        tokenId,
        uri,
        "0.1",
        0 // Using 0 as there's no active phase
      );

      // Set blockchain time to match signature timestamp
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mineBlock();

      // Attempt to mint during gap should fail - using revertedWith instead of revertedWithCustomError
      await expect(
        contract
          .connect(minter)
          .mint(tokenId, uri, uniqueId, timestamp, signature, proof, {
            value: ethers.parseEther("0.1")
          })
      ).to.be.revertedWith("No active phase");
    });
  });

  describe("Interoperability Tests", () => {
    it("should correctly support ERC721Enumerable functionality", async () => {
      // Setup phase
      await contract.connect(owner).addPhase(
        2, // PUBLIC
        ethers.parseEther("0.1"),
        BigInt(globalTimestamp),
        BigInt(globalTimestamp + 86400),
        100,
        10,
        ethers.ZeroHash
      );

      await ethers.provider.send("evm_setNextBlockTimestamp", [
        globalTimestamp + 10
      ]);
      await mineBlock();

      // Get actual phase index for signature
      const [phaseIndex] = await contract.getActivePhase();

      // Mint several tokens with sequential timestamps
      const numTokens = 3; // Reduced for faster tests
      for (let i = 1; i <= numTokens; i++) {
        const tokenId = i.toString();
        const uri = `ipfs://enum${i}`;
        const { signature, uniqueId, timestamp } = await generateSignature(
          minter.address,
          tokenId,
          uri,
          "0.1",
          Number(phaseIndex) // Use correct phase index
        );

        // Set blockchain time to match each signature timestamp, ensuring we advance forward
        await ethers.provider.send("evm_setNextBlockTimestamp", [
          timestamp + i * 10
        ]);
        await mineBlock();

        await contract
          .connect(minter)
          .mint(tokenId, uri, uniqueId, timestamp, signature, [], {
            value: ethers.parseEther("0.1")
          });
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
});
