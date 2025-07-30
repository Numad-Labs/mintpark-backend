import { ethers } from "hardhat";

async function main() {
  // Get the deployer account
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log(
    "Account balance:",
    (await ethers.provider.getBalance(deployer.address)).toString()
  );

  // Contract constructor parameters
  const initialOwner = deployer.address; // You can change this to a different address if needed
  const initialFee = 250; // 2.5% marketplace fee (250 basis points out of 10000)

  console.log("Deploying Marketplace contract...");
  console.log("Initial Owner:", initialOwner);
  console.log(
    "Initial Fee:",
    initialFee,
    "basis points (",
    initialFee / 100,
    "%)"
  );

  // Deploy the contract
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(initialOwner, initialFee);

  await marketplace.waitForDeployment();

  const contractAddress = await marketplace.getAddress();
  console.log("Marketplace deployed to:", contractAddress);

  // Verify deployment
  console.log("Verifying deployment...");
  const owner = await marketplace.owner();
  const fee = await marketplace.marketplaceFee();

  console.log("Contract owner:", owner);
  console.log("Marketplace fee:", fee.toString(), "basis points");

  console.log("\nDeployment completed successfully!");
  console.log("Contract address:", contractAddress);
  console.log("Transaction hash:", marketplace.deploymentTransaction()?.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
