import { Updateable } from "kysely";
import { User } from "../types/db/types";
import { userRepository } from "../repositories/userRepository";
import { CustomError } from "../exceptions/CustomError";
import { generateMessage } from "../libs/generateMessage";
import { generateNonce } from "../libs/generateNonce";
import { redis } from "..";
import { generateTokens } from "../utils/jwt";
import { verifySignedMessage as fractalVerifySignedMessage } from "../../blockchain/utxo/verifyMessageHelper";
import { layerRepository } from "../repositories/layerRepository";
import { verifySignedMessage as citreaVerifySignedMessage } from "../../blockchain/evm/utils";
import { userLayerRepository } from "../repositories/userLayerRepository";

export const userServices = {
  generateMessageToSign: async (address: string) => {
    const nonce = generateNonce();
    const message = generateMessage(address, nonce);
    await redis.set(`nonce:${address}`, nonce, "EX", 300);

    return message;
  },
  login: async (
    address: string,
    pubkey: string,
    signedMessage: string,
    layerId: string
  ) => {
    const nonce = await redis.get(`nonce:${address}`);
    if (!nonce) throw new CustomError("No recorded nonce found.", 400);

    const layer = await layerRepository.getById(layerId);
    if (!layer) throw new CustomError("Layer not found.", 400);

    const message = await generateMessage(address, nonce);

    if (layer.layer === "CITREA" && layer.network === "TESTNET") {
      const isValid = await citreaVerifySignedMessage(
        message,
        signedMessage,
        address
      );
      if (!isValid) throw new CustomError("Invalid signature.", 400);
    }
    if (layer.layer === "BITCOIN" && layer.network === "TESTNET") {
      const isValid = await fractalVerifySignedMessage(
        message,
        signedMessage,
        pubkey,
        layerId
      );
      if (!isValid) throw new CustomError("Invalid signature.", 400);
    } else throw new CustomError("Unsupported layer.", 400);

    const isExistingUserLayer =
      await userLayerRepository.getByAddressAndLayerId(address, layerId);

    if (!isExistingUserLayer) {
      let user = await userRepository.create({ role: "USER" });
      let userLayer = await userLayerRepository;

      const tokens = generateTokens(user);
      return { user, userLayer, tokens };
    }

    const user = await userRepository.getById(isExistingUserLayer.userId);
    if (!user) throw new CustomError("User not found.", 400);

    const tokens = generateTokens(user);
    return { user, userLayer: isExistingUserLayer, tokens };
  },
  linkAccount: async (
    userId: string,
    address: string,
    pubkey: string,
    signedMessage: string,
    layerId: string
  ) => {
    const user = await userRepository.getById(userId);
    if (!user) throw new CustomError("User not found.", 400);

    const nonce = await redis.get(`nonce:${address}`);
    if (!nonce) throw new CustomError("No recorded nonce found.", 400);

    const layer = await layerRepository.getById(layerId);
    if (!layer) throw new CustomError("Layer not found.", 400);

    const message = await generateMessage(address, nonce);

    if (layer.layer === "CITREA" && layer.network === "TESTNET") {
      const isValid = await citreaVerifySignedMessage(
        message,
        signedMessage,
        address
      );
      if (!isValid) throw new CustomError("Invalid signature.", 400);
    }
    if (layer.layer === "BITCOIN" && layer.network === "TESTNET") {
      const isValid = await fractalVerifySignedMessage(
        message,
        signedMessage,
        pubkey,
        layerId
      );
      if (!isValid) throw new CustomError("Invalid signature.", 400);
    } else throw new CustomError("Unsupported layer.", 400);

    const isExistingUserLayer =
      await userLayerRepository.getByAddressAndLayerId(address, layerId);
    if (isExistingUserLayer)
      return { user, userLayer: null, hasAlreadyBeenLinked: false };

    let userLayer = await userLayerRepository.create({
      address,
      userId,
      layerId,
    });

    return { user, userLayer, hasAlreadyBeenLinked: false };
  },
  linkAccountToAnotherUser: async (
    userId: string,
    address: string,
    pubkey: string,
    signedMessage: string,
    layerId: string
  ) => {
    const user = await userRepository.getById(userId);
    if (!user) throw new CustomError("User not found.", 400);

    const nonce = await redis.get(`nonce:${address}`);
    if (!nonce) throw new CustomError("No recorded nonce found.", 400);

    const layer = await layerRepository.getById(layerId);
    if (!layer) throw new CustomError("Layer not found.", 400);

    const message = await generateMessage(address, nonce);

    if (layer.layer === "CITREA" && layer.network === "TESTNET") {
      const isValid = await citreaVerifySignedMessage(
        message,
        signedMessage,
        address
      );
      if (!isValid) throw new CustomError("Invalid signature.", 400);
    }
    if (layer.layer === "BITCOIN" && layer.network === "TESTNET") {
      const isValid = await fractalVerifySignedMessage(
        message,
        signedMessage,
        pubkey,
        layerId
      );
      if (!isValid) throw new CustomError("Invalid signature.", 400);
    } else throw new CustomError("Unsupported layer.", 400);

    const isExistingUserLayer =
      await userLayerRepository.getByAddressAndLayerId(address, layerId);
    if (!isExistingUserLayer)
      throw new CustomError("This account has not been linked yet.", 400);

    let userLayer = await userLayerRepository.updateUserIdById(
      isExistingUserLayer.id,
      userId
    );

    return { user, userLayer, hasAlreadyBeenLinked: false };
  },
};
