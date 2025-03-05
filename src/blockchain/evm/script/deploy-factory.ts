import { HardhatRuntimeEnvironment } from "hardhat/types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";

async function deployFactory(
  hardhatRuntimeEnv?: HardhatRuntimeEnvironment
): Promise<string> {
  // Use the provided HRE or the imported one
  // const { ethers, network } = hardhatRuntimeEnv || hre;

  // Get the deployer's address
  const [deployer]: HardhatEthersSigner[] = await ethers.getSigners();
  console.log(`Deploying NFTFactory with account: ${deployer.address}`);

  // Deploy the NFTFactory contract
  const NFTFactoryContract = await ethers.getContractFactory("NFTFactory");
  const nftFactory = await NFTFactoryContract.deploy();
  const deployTxReceipt = await nftFactory.deploymentTransaction()?.wait();

  console.log(`NFTFactory deployed to: ${await nftFactory.getAddress()}`);

  // Verify contract on Etherscan/Blockscout if not on a local network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Waiting for block confirmations before verification...");
    // Wait for several blocks to make sure deployment is registered
    await new Promise((resolve) => setTimeout(resolve, 30000)); // Wait 30 seconds

    // console.log("Verifying contract on Blockscout...");
    // try {
    //   // Using Hardhat's run function to verify the contract
    //   await hre.run("verify:verify", {
    //     address: await nftFactory.getAddress(),
    //     contract: "NFTFactory",
    //     constructorArguments: []
    //   });
    //   console.log("Contract verified successfully");
    // } catch (error) {
    //   console.error("Error verifying contract:", error);
    // }
  }

  return await nftFactory.getAddress();
}

// For direct script execution
if (require.main === module) {
  deployFactory()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { deployFactory };
