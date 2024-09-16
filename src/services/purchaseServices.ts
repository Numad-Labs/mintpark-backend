import { Insertable } from "kysely";
import { tokenData, utxo } from "../../custom";
import { CustomError } from "../exceptions/CustomError";
import { ASSETTYPE } from "../libs/constants";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { collectionRepository } from "../repositories/collectionRepository";
import { getObjectFromS3 } from "../utils/aws";
import { Purchase } from "../types/db/types";
import { purchaseRepository } from "../repositories/purchaseRepository";
import { transactionRepository } from "../repositories/transactionRepository";
import { userRepository } from "../repositories/userRepository";
import { mintForAnduroWallet } from "../libs/coordinate/mint";
import { checkTransactionStatus, getUtxos } from "../libs/coordinate/libs";

export const purchaseServices = {
  generateTransaction: async (collectionId: string, userId: string) => {
    const collection = await collectionRepository.getById(collectionId);
    if (!collection) throw new CustomError("Collection not found.", 400);

    const collectibles =
      await collectibleRepository.getAvailablesByCollectionId(collectionId);

    const dateUnix = Date.now();
    if (Number(collection.POStartDate) > dateUnix)
      throw new CustomError("Public offering has not started.", 400);

    const winnerIndex = Math.floor(Math.random() * collectibles.length);
    const pickedCollectible = collectibles[winnerIndex];

    if (collectibles.length < 1)
      throw new CustomError("This collection has sold out.", 400);

    const purchaseCount = await purchaseRepository.getPurchaseCountByAddress(
      userId,
      collection.id
    );

    if (purchaseCount > collection.walletLimit)
      throw new CustomError("Wallet limit exceeded.", 400);

    const user = await userRepository.getById(userId);
    if (!user) throw new CustomError("Invalid userId.", 400);

    const file = await getObjectFromS3(pickedCollectible.fileKey);

    const data: tokenData = {
      address: null,
      xpub: user.xpub,
      opReturnValues: [
        {
          image_data: `data:${file.contentType};base64,` + file.content,
          mime: file.contentType?.split("/")[1],
        },
      ],
      assetType: ASSETTYPE.NFTONCHAIN,
      headline: pickedCollectible.name,
      ticker: collection.ticker,
      supply: 1,
    };

    const owner = await userRepository.getById(collection.userId);
    if (!owner) throw new CustomError("Owner not found.", 400);

    const result = await mintForAnduroWallet(
      data,
      owner.address,
      collection.price,
      1
    );

    collection.mintedCount++;
    await collectionRepository.update(collection.id, collection);

    pickedCollectible.status = "ON_HOLD";
    pickedCollectible.transactionId = result.txId;
    const updatedCollectible = await collectibleRepository.update(
      pickedCollectible.id,
      pickedCollectible
    );

    return {
      transactionHash: result.hex,
      collectible: updatedCollectible,
    };
  },
  verify: async (data: Insertable<Purchase>, issuerId: string) => {
    const collectible = await collectibleRepository.getById(data.collectibleId);

    if (!collectible) throw new CustomError("Collectible not found.", 400);
    if (
      collectible.status !== "ON_HOLD" ||
      !collectible.ownerId ||
      !collectible.generatedPsbtTxId
    )
      throw new CustomError("Collectible is not on hold.", 400);
    if (collectible.ownerId !== issuerId)
      throw new CustomError(
        "This collectible is temporarily reserved for another user.",
        400
      );
    if (collectible.generatedPsbtTxId !== data.transactionId)
      throw new CustomError("Invalid transactionId.", 400);

    const isValidTransaction = await checkTransactionStatus(
      collectible.generatedPsbtTxId
    );
    if (!isValidTransaction.broadcasted)
      throw new CustomError("Invalid transactionId.", 400);

    const collection = await collectionRepository.getById(
      collectible.collectionId
    );
    if (!collection) throw new CustomError("Collection not found.", 400);

    const dateUnix = Date.now();
    if (Number(collection.POStartDate) > dateUnix)
      throw new CustomError("Public offering has not started.", 400);

    const purchaseCount = await purchaseRepository.getPurchaseCountByAddress(
      data.buyerId,
      collection.id
    );
    if (purchaseCount > collection.walletLimit)
      throw new CustomError("Wallet limit exceeded.", 400);

    collection.mintedCount++;
    await collectionRepository.update(collection.id, collection);

    const transanction = await transactionRepository.create({
      txid: data.transactionId,
    });

    const purchase = await purchaseRepository.create(data);

    collectible.status = "SOLD";
    collectible.generatedPsbtTxId = null;
    const updatedCollectible = await collectibleRepository.update(
      collectible.id,
      collectible
    );

    return { purchase, updatedCollectible, transanction };
  },
};
