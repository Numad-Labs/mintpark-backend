import * as coordinate from "chromajs-lib";
import * as bitcoin from "bitcoinjs-lib";
import * as bitcoinMessage from "bitcoinjs-message";

//this is for only coordinate anduro wallet
export function verifySignedMessage(
  originalMessage: string,
  signedMessage: string,
  address: string
): boolean {
  console.log({ originalMessage, signedMessage, address });
  const isValidSignature = bitcoinMessage.verify(
    originalMessage,
    address,
    signedMessage,
    coordinate.networks.testnet.messagePrefix,
    true
  );

  return isValidSignature;
}

//need to add for bitcoin and fractal unisat wallet
