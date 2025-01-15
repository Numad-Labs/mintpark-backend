import { verifyMessage } from "@unisat/wallet-utils";
import logger from "../../config/winston";

export function verifySignedMessage(
  originalMessage: string,
  signedMessage: string,
  pubkey: string
): boolean {
  logger.info(verifyMessage(pubkey, originalMessage, signedMessage));

  return verifyMessage(pubkey, originalMessage, signedMessage);
}
