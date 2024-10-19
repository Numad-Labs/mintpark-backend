import {
  generateBuyPsbtHex,
  validateSignAndBroadcastBuyPsbtHex,
} from "../../blockchain/utxo/fractal/buyPsbt";
import {
  getAddressType,
  getInscriptionInfo,
  getInscriptionUtxosByAddress,
} from "../../blockchain/utxo/fractal/libs";
import { createFundingAddress } from "../../blockchain/utxo/fundingAddressHelper";
import { CustomError } from "../exceptions/CustomError";
import { hideSensitiveData } from "../libs/hideDataHelper";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { listRepository } from "../repositories/listRepository";
import { userRepository } from "../repositories/userRepository";

export const listServices = {
  listCollectible: async (
    price: number,
    collectibleId: string,
    issuerId: string
  ) => {
    const issuer = await userRepository.getById(issuerId);
    if (!issuer) throw new CustomError("User not found.", 400);

    const collectible = await collectibleRepository.getById(collectibleId);
    if (!collectible) throw new CustomError("Collectible not found.", 400);
    if (collectible.layer !== "FRACTAL" && collectible.network !== "TESTNET")
      throw new CustomError(
        "This layer 2 is not in function at the moment.",
        400
      );

    const inscription = await getInscriptionInfo(collectible.uniqueIdx);
    if (!inscription)
      throw new CustomError(
        "Invalid inscriptionId, this inscription cant be sold.",
        400
      );
    if (inscription.address !== issuer.address)
      throw new CustomError("You are not the owner of this inscription.", 400);
    if (!inscription.utxo.satoshi)
      throw new CustomError("No inscription satoshi amount found.", 400);

    const latestPendingList =
      await listRepository.getLatestPendingListByCollectibleId(collectible.id);
    if (latestPendingList)
      await listRepository.cancelPendingListingsByCollectibleId(collectible.id);

    const vault = createFundingAddress(collectible.layer, collectible.network);
    const list = await listRepository.create({
      collectibleId: collectible.id,
      sellerId: issuer.id,
      address: vault.address,
      privateKey: vault.privateKey,
      price: price,
      inscribedAmount: inscription.utxo.satoshi,
    });

    const sanitizedList = hideSensitiveData(list, [
      "privateKey",
      "vaultTxid",
      "vaultVout",
    ]);

    return sanitizedList;
  },
  confirmPendingList: async (
    id: string,
    txid: string,
    vout: number,
    inscribedAmount: number
  ) => {
    const list = await listRepository.getById(id);
    if (!list) throw new CustomError("No list found.", 400);
    if (list.status !== "PENDING")
      throw new CustomError("This list is could not be confirmed.", 400);

    if (list.layer !== "FRACTAL" && list.network !== "TESTNET")
      throw new CustomError(
        "This layer 2 is not in function at the moment.",
        400
      );

    const inscription = await getInscriptionInfo(list.uniqueIdx);
    if (!inscription)
      throw new CustomError(
        "Invalid inscriptionId, this inscription cant be sold.",
        400
      );
    if (inscription.address !== list.address)
      throw new CustomError("Collectible has not been transferred yet.", 400);
    if (!inscription.utxo.satoshi)
      throw new CustomError("No inscription satoshi amount found.", 400);
    if (inscription.utxo.satoshi !== inscribedAmount)
      throw new CustomError("Invalid inscribed amount.", 400);

    const updatedList = await listRepository.update(list.id, {
      status: "ACTIVE",
      vaultTxid: txid,
      vaultVout: vout,
      inscribedAmount: inscribedAmount,
    });

    const sanitizedList = hideSensitiveData(updatedList, [
      "privateKey",
      "vaultTxid",
      "vaultVout",
    ]);

    return sanitizedList;
  },
  generateBuyPsbtHex: async (id: string, issuerId: string) => {
    const list = await listRepository.getById(id);
    if (!list) throw new CustomError("No list found.", 400);
    if (list.status !== "ACTIVE")
      throw new CustomError("This list is could not be bought.", 400);
    if (!list.inscribedAmount)
      throw new CustomError("Invalid inscribed amount.", 400);

    const seller = await userRepository.getById(list.sellerId);
    if (!seller) throw new CustomError("Seller not found.", 400);

    const buyer = await userRepository.getById(issuerId);
    if (!buyer) throw new CustomError("User not found.", 400);
    if (buyer.address === seller.address)
      throw new CustomError("You cannot buy your own listing.", 400);

    if (list.layer !== "FRACTAL" && list.network !== "TESTNET")
      throw new CustomError(
        "This layer 2 is not in function at the moment.",
        400
      );

    if (!buyer.pubkey || !list.vaultTxid || list.vaultVout === null)
      throw new CustomError("Invalid fields.", 400);

    const txHex = await generateBuyPsbtHex(
      {
        buyerAddress: buyer.address,
        buyerPubKey: buyer.pubkey,
        sellerAddress: seller.address,
        vaultAddress: list.address,
        vaultTxid: list.vaultTxid,
        vaultVout: list.vaultVout,
        vaultPrivateKey: list.privateKey,
        inscribedAmount: list.inscribedAmount,
        listedPrice: list.price,
      },
      1,
      true
    );

    return txHex;
  },
  buyListedCollectible: async (id: string, hex: string, issuerId: string) => {
    const buyer = await userRepository.getById(issuerId);
    if (!buyer) throw new CustomError("User not found.", 400);

    const list = await listRepository.getById(id);
    if (!list) throw new CustomError("No list found.", 400);
    if (list.status !== "ACTIVE")
      throw new CustomError("This list is could not be bought.", 400);

    const seller = await userRepository.getById(issuerId);
    if (!seller) throw new CustomError("Seller not found.", 400);

    const txid = await validateSignAndBroadcastBuyPsbtHex(
      hex,
      list.privateKey,
      seller.address,
      list.price
    );

    return txid;
  },
};
