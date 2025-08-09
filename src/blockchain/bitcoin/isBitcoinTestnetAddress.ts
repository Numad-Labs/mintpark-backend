export function isBitcoinTestnetAddress(address: string) {
  if (!address || typeof address !== "string") {
    throw new Error("Invalid Bitcoin address");
  }

  // Legacy addresses (P2PKH)
  if (address.startsWith("1")) {
    return false;
  }
  if (address.startsWith("m") || address.startsWith("n")) {
    return true;
  }

  // P2SH addresses
  if (address.startsWith("3")) {
    return false;
  }
  if (address.startsWith("2")) {
    return true;
  }

  if (address.startsWith("bc1")) {
    return false;
  }
  if (address.startsWith("tb1")) {
    return true;
  }

  throw new Error("Invalid Bitcoin address format");
}
