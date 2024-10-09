import { Updateable } from "kysely";
import { User } from "../types/db/types";
import { userRepository } from "../repositories/userRepository";
import { CustomError } from "../exceptions/CustomError";
import { generateMessage } from "../libs/generateMessage";
import { generateNonce } from "../libs/generateNonce";
import { redis } from "..";
import { generateTokens } from "../utils/jwt";
import { verifySignedMessage } from "../libs/coordinate/verifyMessage";

export const userServices = {
  generateMessageToSign: async (address: string) => {
    const nonce = generateNonce();
    const message = generateMessage(address, nonce);
    await redis.set(`nonce:${address}`, nonce, "EX", 300);

    return message;
  },
  login: async (address: string, signedMessage: string, xpub?: string) => {
    const nonce = await redis.get(`nonce:${address}`);
    if (!nonce) throw new CustomError("No recorded nonce found.", 400);
    const message = await generateMessage(address, nonce);

    const isValid = verifySignedMessage(message, signedMessage, address);
    if (!isValid) throw new CustomError("Invalid signature.", 400);

    let user = await userRepository.getByAddress(address);
    if (!user ) {
      user = await userRepository.create({ address: address });
    }

    const tokens = generateTokens(user);

    return { user, tokens };
  },
  update: async (address: string, data: Updateable<User>, issueraddress: string) => {
    const existingUser = await userRepository.getByAddress(address);
    if (!existingUser) throw new CustomError("No user found.", 400);
    if (existingUser.address !== issueraddress)
      throw new CustomError("You are not allowed to do this action.", 400);

    if (data.address || data.createdAt)
      throw new CustomError("Trying to update immutable fields.", 400);

    const user = await userRepository.update(address, data);

    return user;
  },
  delete: async (address: string, issuerAddress: string) => {
    if (address !== issuerAddress)
      throw new CustomError("You are not allowed to do this action.", 400);

    const existingUser = await userRepository.getByAddress(address);
    if (!existingUser) throw new CustomError("No user found.", 400);

    const user = await userRepository.delete(address);

    return user;
  },
};
