import { userRepository } from "../repositories/userRepository";
import { CustomError } from "../exceptions/CustomError";
import { generateMessage } from "../libs/generateMessage";
import { generateNonce } from "../libs/generateNonce";
import { redis } from "..";
import { generateTokens } from "../utils/jwt";
import { layerRepository } from "../repositories/layerRepository";
import { verifySignedMessage as citreaVerifySignedMessage } from "../blockchain/evm/utils";
import { userLayerRepository } from "../repositories/userLayerRepository";
import { verifyMessage as bitcoinVerifySignedMessage } from "@unisat/wallet-utils";
import { isBitcoinTestnetAddress } from "../blockchain/bitcoin/libs";

export const userServices = {
  generateMessageToSign: async (address: string) => {
    const nonce = generateNonce();
    const message = generateMessage(address, nonce);

    await redis.set(`nonce:${address}`, nonce, "EX", 300);

    return message;
  },
  login: async (
    address: string,
    signedMessage: string,
    layerId: string,
    pubkey?: string
  ) => {
    const nonce = await redis.get(`nonce:${address}`);
    if (!nonce) throw new CustomError("No recorded nonce found.", 400);

    const layer = await layerRepository.getById(layerId);
    if (!layer) throw new CustomError("Layer not found.", 400);

    const message = await generateMessage(address, nonce);

    if (layer.layerType === "EVM") {
      const isValid = await citreaVerifySignedMessage(
        message,
        signedMessage,
        address
      );
      if (!isValid) throw new CustomError("Invalid signature.", 400);
    } else if (layer.layer === "BITCOIN" && layer.network === "TESTNET") {
      if (!isBitcoinTestnetAddress(address))
        throw new CustomError(
          `Please switch your wallet's Bitcoin network to TESTNET.`,
          400
        );

      if (!pubkey)
        throw new CustomError(
          "Pubkey must be provided for this operation.",
          400
        );

      const isValid = await bitcoinVerifySignedMessage(
        pubkey,
        message,
        signedMessage
      );
      if (!isValid) throw new CustomError("Invalid signature.", 400);
    } else throw new CustomError("Unsupported layer.", 400);

    const isExistingUserLayer =
      await userLayerRepository.getByAddressAndLayerId(address, layerId);

    if (!isExistingUserLayer) {
      let user = await userRepository.create({ role: "USER" });
      let userLayer = await userLayerRepository.create({
        address: address.toString().toLowerCase(),
        userId: user.id,
        layerId,
        pubkey
      });

      const tokens = generateTokens(user);
      return { user, userLayer, tokens };
    }

    const user = await userRepository.getById(isExistingUserLayer.userId);
    if (!user) throw new CustomError("User not found.", 400);

    await redis.del(`nonce:${address}`);

    const tokens = generateTokens(user);
    return { user, userLayer: isExistingUserLayer, tokens };
  },
  linkAccount: async (
    userId: string,
    address: string,
    signedMessage: string,
    layerId: string,
    pubkey?: string
  ) => {
    const user = await userRepository.getById(userId);
    if (!user) throw new CustomError("User not found.", 400);

    const nonce = await redis.get(`nonce:${address}`);
    if (!nonce) throw new CustomError("No recorded nonce found.", 400);

    const layer = await layerRepository.getById(layerId);
    if (!layer) throw new CustomError("Layer not found.", 400);

    const message = await generateMessage(address, nonce);

    if (layer.layerType === "EVM") {
      const isValid = await citreaVerifySignedMessage(
        message,
        signedMessage,
        address
      );
      if (!isValid) throw new CustomError("Invalid signature.", 400);
    } else if (layer.layer === "BITCOIN" && layer.network === "TESTNET") {
      if (!isBitcoinTestnetAddress(address))
        throw new CustomError(
          `Please switch your wallet's Bitcoin network to TESTNET.`,
          400
        );

      if (!pubkey)
        throw new CustomError(
          "Pubkey must be provided for this operation.",
          400
        );

      const isValid = await bitcoinVerifySignedMessage(
        pubkey,
        message,
        signedMessage
      );
      if (!isValid) throw new CustomError("Invalid signature.", 400);
    } else throw new CustomError("Unsupported layer.", 400);

    const isExistingUserLayer =
      await userLayerRepository.getByAddressAndLayerId(address, layerId);
    if (isExistingUserLayer && isExistingUserLayer.userId === userId)
      return {
        user,
        userLayer: isExistingUserLayer,
        hasAlreadyBeenLinkedToAnotherUser: false
      };
    else if (isExistingUserLayer)
      return {
        user,
        userLayer: null,
        hasAlreadyBeenLinkedToAnotherUser: true
      };

    let userLayer = await userLayerRepository.create({
      address: address.toString().toLowerCase(),
      userId,
      layerId,
      pubkey
    });

    await redis.del(`nonce:${address}`);

    return { user, userLayer, hasAlreadyBeenLinkedToAnotherUser: false };
  },
  linkAccountToAnotherUser: async (
    userId: string,
    address: string,
    signedMessage: string,
    layerId: string,
    pubkey?: string
  ) => {
    const user = await userRepository.getById(userId);
    if (!user) throw new CustomError("User not found.", 400);

    const nonce = await redis.get(`nonce:${address}`);
    if (!nonce) throw new CustomError("No recorded nonce found.", 400);

    const layer = await layerRepository.getById(layerId);
    if (!layer) throw new CustomError("Layer not found.", 400);

    const message = await generateMessage(address, nonce);

    if (layer.layerType === "EVM") {
      const isValid = await citreaVerifySignedMessage(
        message,
        signedMessage,
        address
      );
      if (!isValid) throw new CustomError("Invalid signature.", 400);
    } else if (layer.layer === "BITCOIN" && layer.network === "TESTNET") {
      if (!isBitcoinTestnetAddress(address))
        throw new CustomError(
          `Please switch your wallet's Bitcoin network to TESTNET.`,
          400
        );

      if (!pubkey)
        throw new CustomError(
          "Pubkey must be provided for this operation.",
          400
        );

      const isValid = await bitcoinVerifySignedMessage(
        pubkey,
        message,
        signedMessage
      );
      if (!isValid) throw new CustomError("Invalid signature.", 400);
    } else throw new CustomError("Unsupported layer.", 400);

    const isExistingUserLayer =
      await userLayerRepository.getByAddressAndLayerId(address, layerId);
    if (!isExistingUserLayer)
      throw new CustomError("This account has not been linked yet.", 400);
    if (!isExistingUserLayer.isActive)
      throw new CustomError("This account has already been deactivated.", 400);
    if (isExistingUserLayer.userId === userId)
      throw new CustomError(
        "This account has already been linked to you.",
        400
      );

    await userLayerRepository.deactivateById(isExistingUserLayer.id);
    const userLayer = await userLayerRepository.create({
      address: address.toString().toLowerCase(),
      userId,
      layerId,
      pubkey
    });

    await redis.del(`nonce:${address}`);

    return { user, userLayer };
  }
};
