import * as crypto from "crypto";

import { ethers } from "ethers";
// import * as utils from "ethers/utils"

export function generateNonce(length = 16) {
  return crypto.randomBytes(length).toString("base64");
}

export function generateMessage(address: string, nonce: string, chain: string) {
  return `Wallet address: ${address}, Nonce: ${nonce}, Chain: ${chain}`;
}

export async function verifySignedMessage(
  originalMessage: string,
  signedMessage: string,
  address: string
): Promise<boolean> {
  // if (chain === "btc") {
  //   return bitcoinMessage.verify(
  //     originalMessage,
  //     address,
  //     signedMessage,
  //     coordinate.networks.testnet.messagePrefix,
  //     true
  //   );
  // } else if (chain === "evm") {
  const signerAddr = ethers.verifyMessage(originalMessage, signedMessage);
  return signerAddr.toLowerCase() === address.toLowerCase();
  // } else {
  //   throw new Error("Unsupported chain");
  // }
}

export function serializeBigInt(obj: any): any {
  if (typeof obj === "bigint") {
    return obj.toString();
  } else if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  } else if (typeof obj === "object" && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, serializeBigInt(value)])
    );
  }
  return obj;
}
