import { verifyMessage } from "@unisat/wallet-utils";
import logger from "../../config/winston";

const secp256k1 = require("noble-secp256k1");
const { bech32m } = require("bech32");

export function verifySignedMessage(
  originalMessage: string,
  signedMessage: string,
  pubkey: string
): boolean {
  logger.info(verifyMessage(pubkey, originalMessage, signedMessage));

  return verifyMessage(pubkey, originalMessage, signedMessage);
}
