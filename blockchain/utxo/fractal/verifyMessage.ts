import * as bitcoin from "bitcoinjs-lib";
import bitcoinMessage from "bitcoinjs-message";
import { getAddressType } from "./libs";
import { CustomError } from "../../../src/exceptions/CustomError";
import { verifyMessage } from "@unisat/wallet-utils";

const secp256k1 = require("noble-secp256k1");
const { bech32m } = require("bech32");

export function verifySignedMessageFractal(
  originalMessage: string,
  signedMessage: string,
  pubkey: string
): boolean {
  console.log(pubkey)
  // const addressType = getAddressType(address);

  // if (addressType.script === "p2tr") {
  //   // return verifyTaprootSignature(originalMessage, signedMessage, address);
  //   throw new CustomError("Taproot verification is not supported yet.", 400);
  // }

  // console.log("Login address type: ", addressType.script);

  console.log(verifyMessage(pubkey, originalMessage, signedMessage))

  return verifyMessage(pubkey, originalMessage, signedMessage)

  // return bitcoinMessage.verify(
  //   originalMessage,
  //   address,
  //   signedMessage,
  //   bitcoin.networks.bitcoin.messagePrefix,
  //   true
  // );
}

function verifyTaprootSignature(
  originalMessage: string,
  signedMessage: string,
  address: string
) {
  // Decode the Taproot address
  const { words } = bech32m.decode(address);
  const pubKeyBytes = bech32m.fromWords(words);

  // Convert the pubkey to hex
  const pubKeyHex = Buffer.from(pubKeyBytes).toString("hex");

  // Verify the signature
  const messageHash = secp256k1.utils.sha256(originalMessage);
  return secp256k1.schnorr.verify(signedMessage, messageHash, pubKeyHex);
}
