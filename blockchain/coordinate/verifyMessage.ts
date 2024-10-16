import * as coordinate from "chromajs-lib";
import * as bitcoinMessage from "bitcoinjs-message";

export function verifySignedMessageCoordinate(
  originalMessage: string,
  signedMessage: string,
  address: string
): boolean {
  const isValidSignature = bitcoinMessage.verify(
    originalMessage,
    address,
    signedMessage,
    coordinate.networks.testnet.messagePrefix,
    true
  );

  return isValidSignature;
}
