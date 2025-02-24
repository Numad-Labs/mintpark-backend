import { expect } from "chai";
import { ethers } from "hardhat";
import { LaunchNFTV2 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("High Traffic Scenarios", () => {
  let contract: LaunchNFTV2;
  let owner: SignerWithAddress;
  let backendSigner: SignerWithAddress;
  let platformFeeRecipient: SignerWithAddress;
  let minters: SignerWithAddress[];
  let globalTimestamp: number;

  const INITIAL_ROYALTY_FEE = 500; // 5%
  const INITIAL_PLATFORM_FEE = 250; // 2.5%
  const CONTRACT_NAME = "Test NFT";
  const CONTRACT_SYMBOL = "TNFT";
  const MINT_PRICE = "0.1";
  const PHASE_MAX_SUPPLY = 1000;
  const CONCURRENT_MINTS = 50;

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

    const latestBlock = await ethers.provider.getBlock("latest");
    globalTimestamp = Number(latestBlock!.timestamp);
  }

  async function generateMintSignature(
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

  beforeEach(async () => {
    [owner, backendSigner, platformFeeRecipient, ...minters] =
      await ethers.getSigners();
  });

  it("should handle 50 truly concurrent mints", async () => {
    await deployContract();

    // Add public phase
    await contract.connect(owner).addPhase(
      2, // PUBLIC
      ethers.parseEther(MINT_PRICE),
      BigInt(globalTimestamp),
      BigInt(globalTimestamp + 86400),
      PHASE_MAX_SUPPLY,
      0,
      ethers.ZeroHash
    );

    // Generate all mint requests first
    const mintRequests = await Promise.all(
      Array(CONCURRENT_MINTS)
        .fill(null)
        .map(async (_, i) => {
          const minter = minters[i % minters.length];
          const tokenId = (i + 1).toString();
          const uri = `ipfs://test/${tokenId}`;

          const { signature, uniqueId, timestamp } =
            await generateMintSignature(
              minter.address,
              tokenId,
              uri,
              MINT_PRICE,
              1
            );

          return {
            minter,
            tokenId,
            uri,
            signature,
            uniqueId,
            timestamp
          };
        })
    );

    // Launch all mints simultaneously
    const mintPromises = mintRequests.map(
      ({ minter, tokenId, uri, signature, uniqueId, timestamp }) =>
        contract
          .connect(minter)
          .mint(tokenId, uri, uniqueId, timestamp, signature, [], {
            value: ethers.parseEther(MINT_PRICE)
          })
    );

    // Wait for all mints to complete
    const results = await Promise.allSettled(mintPromises);

    // Check for any failures
    const failures = results.filter((r) => r.status === "rejected");
    expect(failures.length).to.equal(0, `${failures.length} mints failed`);

    // Verify total minted amount
    const [_, currentPhase] = await contract.getActivePhase();
    expect(currentPhase.mintedInPhase).to.equal(BigInt(CONCURRENT_MINTS));

    // Verify random tokens
    for (let i = 0; i < 5; i++) {
      const randomIndex = Math.floor(Math.random() * CONCURRENT_MINTS);
      const tokenId = (randomIndex + 1).toString();
      const owner = await contract.ownerOf(tokenId);
      expect(owner).to.equal(mintRequests[randomIndex].minter.address);
    }
  });

  it("should maintain accurate fee distribution under concurrent load", async () => {
    await deployContract();

    await contract.connect(owner).addPhase(
      2, // PUBLIC
      ethers.parseEther(MINT_PRICE),
      BigInt(globalTimestamp),
      BigInt(globalTimestamp + 86400),
      PHASE_MAX_SUPPLY,
      0,
      ethers.ZeroHash
    );

    const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
    const initialPlatformBalance = await ethers.provider.getBalance(
      platformFeeRecipient.address
    );

    const mintRequests = await Promise.all(
      Array(CONCURRENT_MINTS)
        .fill(null)
        .map(async (_, i) => {
          const minter = minters[i % minters.length];
          const tokenId = (i + 1).toString();
          const uri = `ipfs://test/${tokenId}`;

          const { signature, uniqueId, timestamp } =
            await generateMintSignature(
              minter.address,
              tokenId,
              uri,
              MINT_PRICE,
              1
            );

          return {
            minter,
            tokenId,
            uri,
            signature,
            uniqueId,
            timestamp
          };
        })
    );

    // Launch all mints concurrently
    const mintPromises = mintRequests.map(
      ({ minter, tokenId, uri, signature, uniqueId, timestamp }) =>
        contract
          .connect(minter)
          .mint(tokenId, uri, uniqueId, timestamp, signature, [], {
            value: ethers.parseEther(MINT_PRICE)
          })
    );

    await Promise.all(mintPromises);

    const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
    const finalPlatformBalance = await ethers.provider.getBalance(
      platformFeeRecipient.address
    );

    const totalMintValue =
      BigInt(ethers.parseEther(MINT_PRICE)) * BigInt(CONCURRENT_MINTS);
    const expectedPlatformFee =
      (totalMintValue * BigInt(INITIAL_PLATFORM_FEE)) / BigInt(10000);
    const expectedOwnerAmount = totalMintValue - expectedPlatformFee;

    expect(finalPlatformBalance - initialPlatformBalance).to.equal(
      expectedPlatformFee
    );
    expect(finalOwnerBalance - initialOwnerBalance).to.equal(
      expectedOwnerAmount
    );
  });
});
