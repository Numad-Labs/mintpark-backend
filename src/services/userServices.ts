import { userRepository } from "../repositories/userRepository";
import { CustomError } from "../exceptions/CustomError";
import { generateMessage } from "../libs/generateMessage";
import { generateNonce } from "../libs/generateNonce";
import { redis } from "..";
import { generateTokens } from "../utils/jwt";
import { layerRepository } from "../repositories/layerRepository";
import { verifySignedMessage as EvmVerifySignedMessage } from "../blockchain/evm/utils";
import { userLayerRepository } from "../repositories/userLayerRepository";
import { verifyMessage as bitcoinVerifySignedMessage } from "@unisat/wallet-utils";
import { isBitcoinTestnetAddress } from "@blockchain/bitcoin/isBitcoinTestnetAddress";

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
      const isValid = await EvmVerifySignedMessage(
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

    const layer = await layerRepository.getById(layerId);
    if (!layer) throw new CustomError("Layer not found.", 400);

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

    const isLinkingSameAddress =
      signedMessage === "" && layer.layerType === "EVM";
    if (isLinkingSameAddress) {
      const alreadyConnectedUserLayerWithSameAddress =
        await userLayerRepository.getByAddressAndUserId(address, userId);
      if (!alreadyConnectedUserLayerWithSameAddress)
        throw new CustomError(
          "Could not find the already connected user layer with given address",
          400
        );

      const newUserLayer = await userLayerRepository.create({
        address: address.toString().toLowerCase(),
        userId,
        layerId,
        pubkey
      });

      return {
        user,
        userLayer: newUserLayer,
        hasAlreadyBeenLinkedToAnotherUser: false
      };
    }

    const nonce = await redis.get(`nonce:${address}`);
    if (!nonce) throw new CustomError("No recorded nonce found.", 400);
    const message = await generateMessage(address, nonce);

    if (layer.layerType === "EVM") {
      const isValid = await EvmVerifySignedMessage(
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

    const layer = await layerRepository.getById(layerId);
    if (!layer) throw new CustomError("Layer not found.", 400);

    const isExistingUserLayer =
      await userLayerRepository.getByAddressAndLayerId(address, layerId);
    if (!isExistingUserLayer)
      throw new CustomError("This account has not been linked yet.", 400);
    if (isExistingUserLayer.userId === userId)
      throw new CustomError(
        "This account has already been linked to you.",
        400
      );

    const isLinkingSameAddress =
      signedMessage === "" && layer.layerType === "EVM";
    if (isLinkingSameAddress) {
      const alreadyConnectedUserLayerWithSameAddress =
        await userLayerRepository.getByAddressAndUserId(address, userId);
      if (!alreadyConnectedUserLayerWithSameAddress)
        throw new CustomError(
          "Could not find the already connected user layer with given address",
          400
        );

      const newUserLayer = await userLayerRepository.create({
        address: address.toString().toLowerCase(),
        userId,
        layerId,
        pubkey
      });

      await userLayerRepository.deactivateById(isExistingUserLayer.id);

      return {
        user,
        userLayer: newUserLayer,
        hasAlreadyBeenLinkedToAnotherUser: false
      };
    }

    const nonce = await redis.get(`nonce:${address}`);
    if (!nonce) throw new CustomError("No recorded nonce found.", 400);
    const message = await generateMessage(address, nonce);

    if (layer.layerType === "EVM") {
      const isValid = await EvmVerifySignedMessage(
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
