import { ethers } from "ethers";
import { CustomError } from "../../../../exceptions/CustomError";
import { EVM_CONFIG } from "../../evm-config";

export function validateUpdatePhaseParams(
  collectionAddress: string,
  phaseIndex: number,
  phaseType: number,
  price: bigint,
  startTime: number,
  endTime: number,
  maxSupply: number,
  maxPerWallet: number,
  merkleRoot: string,
  from: string
) {
  // Validate collection address
  if (!ethers.isAddress(collectionAddress)) {
    throw new CustomError("Invalid collection address", 400);
  }

  // Validate from address
  if (!ethers.isAddress(from)) {
    throw new CustomError("Invalid from address", 400);
  }

  if (from === ethers.ZeroAddress) {
    throw new CustomError("From address cannot be zero address", 400);
  }

  // Validate phase index
  if (phaseIndex < 0) {
    throw new CustomError("Phase index cannot be negative", 400);
  }

  // Check if the phase exists
  const contract = new ethers.Contract(
    collectionAddress,
    EVM_CONFIG.DIRECT_MINT_NFT_ABI,
    this.provider
  );

  const phaseCount = await contract.getPhaseCount();
  if (BigInt(phaseIndex) >= phaseCount) {
    throw new CustomError("Invalid phase index", 400);
  }

  // Validate phase type
  if (phaseType < 0 || phaseType > 2) {
    // NOT_STARTED=0, WHITELIST=1, PUBLIC=2
    throw new CustomError("Invalid phase type", 400);
  }

  // Validate time range
  if (startTime >= endTime) {
    throw new CustomError("Start time must be before end time", 400);
  }

  // Validate price
  try {
    const priceInEther = price;
    if (priceInEther < BigInt(0)) {
      throw new CustomError("Price cannot be negative", 400);
    }
  } catch {
    throw new CustomError("Invalid price format", 400);
  }

  // Validate max per wallet for non-public phases
  if (phaseType !== 2 && maxPerWallet <= 0) {
    // 2 = PUBLIC
    throw new CustomError(
      "Max per wallet must be positive for non-public phases",
      400
    );
  }

  // Validate merkle root for whitelist phase
  if (
    phaseType === 1 &&
    (!merkleRoot ||
      merkleRoot ===
        "0x0000000000000000000000000000000000000000000000000000000000000000")
  ) {
    throw new CustomError("Merkle root required for whitelist phase", 400);
  }
}

export function validateDeploymentParams(
  initialOwner: string,
  contractName: string,
  symbol: string,
  royaltyFee: number,
  platformFee: number
) {
  if (!ethers.isAddress(initialOwner)) {
    throw new CustomError("Invalid initial owner address", 400);
  }

  if (initialOwner === ethers.ZeroAddress) {
    throw new CustomError("Initial owner cannot be zero address", 400);
  }

  if (
    !contractName ||
    contractName.length < this.MIN_CONTRACT_NAME_LENGTH ||
    contractName.length > this.MAX_CONTRACT_NAME_LENGTH
  ) {
    throw new CustomError(
      `Contract name must be between ${this.MIN_CONTRACT_NAME_LENGTH} and ${this.MAX_CONTRACT_NAME_LENGTH} characters`,
      400
    );
  }

  if (
    !symbol ||
    symbol.length < this.MIN_SYMBOL_LENGTH ||
    symbol.length > this.MAX_SYMBOL_LENGTH
  ) {
    throw new CustomError(
      `Symbol must be between ${this.MIN_SYMBOL_LENGTH} and ${this.MAX_SYMBOL_LENGTH} characters`,
      400
    );
  }

  if (royaltyFee < 0 || royaltyFee > this.MAX_ROYALTY_FEE) {
    throw new CustomError(
      `Royalty fee must be between 0 and ${this.MAX_ROYALTY_FEE} (${this.MAX_ROYALTY_FEE / 100}%)`,
      400
    );
  }

  if (platformFee < 0 || platformFee > this.MAX_PLATFORM_FEE) {
    throw new CustomError(
      `Platform fee must be between 0 and ${this.MAX_PLATFORM_FEE} (${this.MAX_PLATFORM_FEE / 100}%)`,
      400
    );
  }
}
