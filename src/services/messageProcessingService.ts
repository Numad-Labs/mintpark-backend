import { Message } from "@aws-sdk/client-sqs";
import { CustomError } from "../exceptions/CustomError";
import logger from "../config/winston";
import { orderRepository } from "../repositories/orderRepostory";
import { z } from "zod";
import { orderItemRepository } from "../repositories/orderItemRepository";
import { collectionRepository } from "../repositories/collectionRepository";
import { db } from "../utils/db";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { producer } from "..";
import { traitValueRepository } from "../repositories/traitValueRepository";
import { createFundingAddress } from "../blockchain/bitcoin/createFundingAddress";
import { inscribe } from "../blockchain/bitcoin/inscribe";
import { userRepository } from "../repositories/userRepository";
import { getObjectFromS3 } from "../utils/aws";
import { sendRawTransaction } from "../blockchain/bitcoin/sendTransaction";
import NFTService from "../blockchain/evm/services/nftService";
import { EVM_CONFIG } from "../blockchain/evm/evm-config";
import MarketplaceService from "../blockchain/evm/services/marketplaceService";
import { getBalance } from "../blockchain/bitcoin/libs";
import { bigint } from "hardhat/internal/core/params/argumentTypes";

export const orderIdSchema = z.string().uuid();

const nftService = new NFTService(EVM_CONFIG.RPC_URL);

export async function processMessage(message: Message) {
  // console.log("message", message, new Date());
  if (!message.Body) throw new CustomError("Invalid message body.", 400);
  const parsedMessage = JSON.parse(message.Body);
  const isValidMessage = orderIdSchema.safeParse(parsedMessage);
  if (!isValidMessage.success)
    throw new CustomError(`Invalid orderId: ${message.Body}`, 400);

  logger.info(`Received message: ${isValidMessage.data}`);

  const order = await orderRepository.getById(isValidMessage.data);
  if (!order) throw new CustomError(`Order not found: ${message.Body}`, 400);
  if (order.orderStatus === "DONE")
    throw new CustomError(`Order has already been minted: ${order.id}`, 400);
  if (
    !(
      order.orderType === "MINT_COLLECTIBLE" ||
      order.orderType === "MINT_RECURSIVE_COLLECTIBLE"
    )
  )
    throw new CustomError("Order with invalid order type.", 400);
  if (!order.collectionId)
    throw new CustomError("Order does not have collectionId.", 400);
  if (!order.fundingAddress)
    throw new CustomError("Order does not have funding address.", 400);

  logger.info(`Started processing order: ${order.id}`);

  const creator = await userRepository.getByUserLayerId(order.userLayerId);
  if (!creator) throw new CustomError("Order creator not found.", 400);
  if (!creator.isActive)
    throw new CustomError("This account is deactivated.", 400);

  const collection = await collectionRepository.getById(db, order.collectionId);
  if (!collection) throw new CustomError("Collection not found.", 400);

  if (
    collection.type === "INSCRIPTION" ||
    collection.type === "RECURSIVE_INSCRIPTION"
  ) {
    const balance = await getBalance(order.fundingAddress);
    if (balance < order.fundingAmount)
      throw new CustomError("Fee has not been transferred yet.", 400);
  } else if (
    collection.type === "IPFS_CID" ||
    collection.type === "IPFS_FILE"
  ) {
    //DG TODO: VALIDATE IF VAULT HAS BEEN FUNDED BY order.fundingAmount
  }

  if (collection.type === "INSCRIPTION") {
    const L2Collection =
      await collectionRepository.getChildCollectionByParentCollectionId(
        collection.id
      );
    if (!L2Collection || L2Collection.type !== "SYNTHETIC")
      throw new CustomError("Invalid child collection.", 400);

    if (!order.fundingAddress || !order.privateKey)
      throw new CustomError(
        "Order has invalid funding address and private key.",
        400
      );

    const orderItem =
      await orderItemRepository.getInQueueOrderItemByOrderIdAndType(
        order.id,
        "COLLECTIBLE"
      );
    if (!orderItem) return;
    if (!orderItem.collectibleId)
      throw new CustomError("Collectible id not found on the order item.", 400);
    logger.info(`Started processing order item: ${orderItem.id}`);

    const parentCollectible = await collectibleRepository.getById(
      orderItem.collectibleId
    );
    if (!parentCollectible)
      throw new CustomError("Parent collectible not found.", 400);
    if (!parentCollectible.fileKey)
      throw new CustomError("Parent collectible's filekey not found.", 400);

    const vault = await createFundingAddress("TESTNET");
    const file = await getObjectFromS3(parentCollectible.fileKey);
    const inscriptionData = {
      address: vault.address,
      opReturnValues: `data:${file.contentType};base64,${(
        file.content as Buffer
      ).toString("base64")}` as any
    };
    const { commitTxHex, revealTxHex } = await inscribe(
      inscriptionData,
      order.fundingAddress,
      order.privateKey,
      true,
      order.feeRate
    );
    const commitTxResult = await sendRawTransaction(commitTxHex);
    if (!commitTxResult)
      throw new CustomError("Could not broadcast the commit tx.", 400);
    const revealTxResult = await sendRawTransaction(revealTxHex);
    if (!revealTxResult)
      throw new CustomError("Could not broadcast the reveal tx.", 400);
    logger.info(
      `Inscribed the order item: ${orderItem.id} in transaction: ${commitTxResult} + ${revealTxResult}`
    );

    await orderItemRepository.update(orderItem?.id, { status: "MINTED" });

    if (!L2Collection.contractAddress) {
      throw new CustomError("L2Collection contract address not found.", 400);
    }

    const inscriptionId = revealTxResult + "i0";
    let mintTxId;
    // l2Collectible.
    try {
      // Mint the NFT with the inscription ID
      mintTxId = await nftService.mintWithInscriptionId(
        L2Collection.contractAddress,
        creator.address,
        inscriptionId,
        parentCollectible.nftId,
        0
      );
      logger.info(
        `Minted the order item: ${orderItem.id} in transaction: ${mintTxId}`
      );
      // vault.address = fundingService.getVaultAddress();

      if (!mintTxId) {
        throw new CustomError("Failed to mint NFT with inscription ID", 400);
      }
    } catch (error) {
      logger.error("Error during NFT minting:", error);
      throw new CustomError(`Failed to mint NFT: ${error}`, 400);
    }

    if (collection.status !== "CONFIRMED")
      await collectionRepository.update(db, collection.id, {
        status: "CONFIRMED"
      });

    if (L2Collection.status !== "CONFIRMED")
      await collectionRepository.update(db, L2Collection.id, {
        status: "CONFIRMED"
      });

    await collectibleRepository.update(db, parentCollectible.id, {
      lockingAddress: vault.address,
      lockingPrivateKey: vault.privateKey,
      mintingTxId: revealTxResult,
      uniqueIdx: inscriptionId,
      status: "CONFIRMED"
    });

    const l2Collectible = await collectibleRepository.create(db, {
      name: parentCollectible.name,
      collectionId: L2Collection.id,
      uniqueIdx: L2Collection.contractAddress + "i" + parentCollectible.nftId,
      nftId: parentCollectible.nftId,
      mintingTxId: mintTxId,
      parentCollectibleId: parentCollectible.id,
      fileKey: parentCollectible.fileKey,
      status: "CONFIRMED"
    });

    await collectionRepository.incrementCollectionSupplyById(db, collection.id);
    await collectionRepository.incrementCollectionSupplyById(
      db,
      L2Collection.id
    );

    const hasRemainingOrderItem =
      await orderItemRepository.getInQueueOrderItemByOrderIdAndType(
        order.id,
        "COLLECTIBLE"
      );

    if (!hasRemainingOrderItem)
      await orderRepository.updateOrderStatus(order.id, "DONE");
    else producer.sendMessage(order.id, 120);

    logger.info(`Finished processing the order item: ${orderItem.id}`);

    return;
  } else if (collection.type === "RECURSIVE_INSCRIPTION") {
    const L2Collection =
      await collectionRepository.getChildCollectionByParentCollectionId(
        collection.id
      );
    if (!L2Collection || L2Collection.type !== "SYNTHETIC")
      throw new CustomError("Invalid child collection.", 400);

    const traitOrderItem =
      await orderItemRepository.getInQueueOrderItemByOrderIdAndType(
        order.id,
        "TRAIT"
      );
    if (traitOrderItem) {
      if (!traitOrderItem.traitValueId)
        throw new CustomError(
          "Collectible id not found on the order item.",
          400
        );

      await orderItemRepository.update(traitOrderItem?.id, {
        status: "MINTED"
      });

      // const parentCollectible = await collectibleRepository.getById(
      //   orderItem.collectibleId
      // );
      // if (!parentCollectible)
      //   throw new CustomError("Parent collectible not found.", 400);

      const traitValue = await traitValueRepository.getById(
        traitOrderItem.traitValueId
      );
      if (!traitValue) throw new CustomError("Trait value not found.", 400);

      const vault = await createFundingAddress("TESTNET");
      logger.info(
        `Minted RECURSIVE_TRAIT: ${traitValue?.id} Funded by: ${order.fundingAddress}`
      );
      let mintTxId = "";

      await traitValueRepository.updateById(traitValue?.id, {
        inscriptionId: mintTxId,
        lockingAddress: vault.address,
        lockingPrivateKey: vault.privateKey
      });

      producer.sendMessage(order.id, 120);

      return;
    } else {
      const orderItem =
        await orderItemRepository.getInQueueOrderItemByOrderIdAndType(
          order.id,
          "COLLECTIBLE"
        );
      if (!orderItem) return;
      if (!orderItem.collectibleId)
        throw new CustomError(
          "Collectible id not found on the order item.",
          400
        );

      await orderItemRepository.update(orderItem?.id, { status: "MINTED" });

      const parentCollectible = await collectibleRepository.getById(
        orderItem.collectibleId
      );
      if (!parentCollectible)
        throw new CustomError("Parent collectible not found.", 400);

      const vault = await createFundingAddress("TESTNET");
      logger.info(
        `Minted RECURSIVE_INSCRIPTION: ${orderItem?.collectibleId} Funded by: ${order.fundingAddress}`
      );
      logger.info(`Minted NFT funded by VAULT`);
      let mintTxId = "";

      await collectibleRepository.update(db, parentCollectible.id, {
        lockingAddress: vault.address,
        lockingPrivateKey: vault.privateKey,
        mintingTxId: mintTxId,
        status: "CONFIRMED"
      });

      const l2Collectible = await collectibleRepository.create(db, {
        name: parentCollectible.name,
        collectionId: L2Collection.id,
        uniqueIdx: L2Collection.contractAddress + "i" + parentCollectible.nftId,
        nftId: parentCollectible.nftId,
        mintingTxId: mintTxId,
        parentCollectibleId: parentCollectible.id,
        fileKey: parentCollectible.fileKey
      });

      await collectionRepository.incrementCollectionSupplyById(
        db,
        collection.id
      );
      await collectionRepository.incrementCollectionSupplyById(
        db,
        L2Collection.id
      );

      const hasRemainingOrderItem =
        await orderItemRepository.getInQueueOrderItemByOrderIdAndType(
          order.id,
          "COLLECTIBLE"
        );

      if (!hasRemainingOrderItem)
        await orderRepository.updateOrderStatus(order.id, "DONE");
      else producer.sendMessage(order.id, 120);

      logger.info(`Finished processing the order item: ${orderItem.id}`);

      return;
    }
  } else if (
    collection.type === "IPFS_CID" ||
    collection.type === "IPFS_FILE"
  ) {
    const orderItem =
      await orderItemRepository.getInQueueOrderItemByOrderIdAndType(
        order.id,
        "COLLECTIBLE"
      );
    if (!orderItem) return;
    if (!orderItem.collectibleId)
      throw new CustomError("Collectible id not found on the order item.", 400);

    await orderItemRepository.update(orderItem?.id, { status: "MINTED" });

    const collectible = await collectibleRepository.getById(
      orderItem.collectibleId
    );
    if (!collectible)
      throw new CustomError("Parent collectible not found.", 400);

    let mintTxId = "";
    if (collection.type === "IPFS_CID") {
      //DG TODO: MINT NFT FROM CID TO creator.address BY THE VAULT
    } else if (collection.type === "IPFS_FILE") {
      //ONLY FOR MINTING SINGLE COLLECTIBLE, WITH UNCONFIRMED COLLECTION
      //DG TODO: MINT NFT FROM collectible.fileKey file TO creator.address BY THE VAULT
    }

    await collectibleRepository.update(db, collectible.id, {
      mintingTxId: mintTxId,
      status: "CONFIRMED"
    });
    await collectionRepository.incrementCollectionSupplyById(db, collection.id);

    const hasRemainingOrderItem =
      await orderItemRepository.getInQueueOrderItemByOrderIdAndType(
        order.id,
        "COLLECTIBLE"
      );

    if (!hasRemainingOrderItem)
      await orderRepository.updateOrderStatus(order.id, "DONE");
    else producer.sendMessage(order.id, 120);

    logger.info(`Finished processing the order item: ${orderItem.id}`);
  } else throw new CustomError("Invalid collection type.", 400);
}
