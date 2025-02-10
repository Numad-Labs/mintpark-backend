import { ethers } from "ethers";
import axios from "axios";

async function isTokenURIValid(tokenId: number): Promise<boolean> {
  const provider = new ethers.JsonRpcProvider("https://rpc.testnet.citrea.xyz");
  const contractAddress = "0x6C3729b780F447D5DF56841a7F0f9F6C409275DE";

  try {
    const abi = ["function tokenURI(uint256 tokenId) view returns (string)"];
    const contract = new ethers.Contract(contractAddress, abi, provider);

    const tokenURI = await contract.tokenURI(tokenId);
    console.log("🚀 ~ isTokenURIValid ~ tokenURI:", tokenURI);
    if (!tokenURI) return false;

    const url = tokenURI.startsWith("ipfs://")
      ? `https://ipfs.io/ipfs/${tokenURI.slice(7)}`
      : tokenURI;

    await axios.get(url, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// Usage:
const tokenId = 4943; // your token id
isTokenURIValid(tokenId).then((isValid) =>
  console.log(`Token ${tokenId} URI is ${isValid ? "valid" : "invalid"}`)
);
