import { Message } from "@aws-sdk/client-sqs";
import { CustomError } from "../exceptions/CustomError";
import logger from "../config/winston";
import { orderRepository } from "../repositories/orderRepostory";
import { z } from "zod";
import { orderItemRepository } from "../repositories/orderItemRepository";
import { collectionRepository } from "../repositories/collectionRepository";
import { db } from "../utils/db";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { createFundingAddress } from "../../blockchain/utxo/fundingAddressHelper";
import { producer } from "..";
import { traitValueRepository } from "../repositories/traitValueRepository";

export const orderIdSchema = z.string().uuid();

export async function processMessage(message: Message) {
  if (!message.Body) throw new CustomError("Invalid message body.", 400);
  const isValidMessage = orderIdSchema.safeParse(message.Body);
  if (!isValidMessage.success)
    throw new CustomError(`Invalid orderId: ${message.Body}`, 400);

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

  const collection = await collectionRepository.getById(db, order.collectionId);
  if (!collection) throw new CustomError("Collection not found.", 400);

  if (collection.type === "INSCRIPTION") {
    const L2Collection =
      await collectionRepository.getChildCollectionByParentCollectionId(
        collection.id
      );
    if (!L2Collection || L2Collection.type !== "SYNTHETIC")
      throw new CustomError("Invalid child collection.", 400);

    const orderItem =
      await orderItemRepository.getInQueueOrderItemByOrderIdAndType(
        order.id,
        "COLLECTIBLE"
      );
    if (!orderItem) return;
    if (!orderItem.collectibleId)
      throw new CustomError("Collectible id not found on the order item.", 400);

    await orderItemRepository.update(orderItem?.id, { status: "MINTED" });

    const parentCollectible = await collectibleRepository.getById(
      orderItem.collectibleId
    );
    if (!parentCollectible)
      throw new CustomError("Parent collectible not found.", 400);

    const vault = await createFundingAddress("BITCOIN", "TESTNET");
    logger.info(
      `Minted INSCRIPTION: ${orderItem?.collectibleId} Funded by: ${order.fundingAddress}`
    );
    logger.info(`Minted NFT funded by VAULT`);
    let mintTxId = "";

    await collectibleRepository.update(db, parentCollectible.id, {
      lockingAddress: vault.address,
      lockingPrivateKey: vault.privateKey,
      mintingTxId: mintTxId,
    });

    const l2Collectible = await collectibleRepository.create(db, {
      name: parentCollectible.name,
      collectionId: L2Collection.id,
      uniqueIdx: L2Collection.contractAddress + "i" + parentCollectible.nftId,
      nftId: parentCollectible.nftId,
      mintingTxId: mintTxId,
      parentCollectibleId: parentCollectible.id,
      fileKey: parentCollectible.fileKey,
    });

    const hasRemainingOrderItem =
      await orderItemRepository.getInQueueOrderItemByOrderIdAndType(
        order.id,
        "COLLECTIBLE"
      );
    if (!hasRemainingOrderItem) {
      await orderRepository.updateOrderStatus(order.id, "DONE");

      if (collection.status !== "CONFIRMED") {
        await collectionRepository.update(db, collection.id, {
          status: "CONFIRMED",
        });

        if (L2Collection.status !== "CONFIRMED")
          await collectionRepository.update(db, L2Collection.id, {
            status: "CONFIRMED",
          });
      }
    } else {
      //ENQUEUE ORDERID
      producer.sendMessage(order.id, 1);
    }

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
        status: "MINTED",
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

      const vault = await createFundingAddress("BITCOIN", "TESTNET");
      logger.info(
        `Minted RECURSIVE_TRAIT: ${traitValue?.id} Funded by: ${order.fundingAddress}`
      );
      let mintTxId = "";

      await traitValueRepository.updateById(traitValue?.id, {
        inscriptionId: mintTxId,
        lockingAddress: vault.address,
        lockingPrivateKey: vault.privateKey,
      });

      //ENQUEUE ORDERID
      producer.sendMessage(order.id, 1);

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

      const vault = await createFundingAddress("BITCOIN", "TESTNET");
      logger.info(
        `Minted RECURSIVE_INSCRIPTION: ${orderItem?.collectibleId} Funded by: ${order.fundingAddress}`
      );
      logger.info(`Minted NFT funded by VAULT`);
      let mintTxId = "";

      await collectibleRepository.update(db, parentCollectible.id, {
        lockingAddress: vault.address,
        lockingPrivateKey: vault.privateKey,
        mintingTxId: mintTxId,
      });

      const l2Collectible = await collectibleRepository.create(db, {
        name: parentCollectible.name,
        collectionId: L2Collection.id,
        uniqueIdx: L2Collection.contractAddress + "i" + parentCollectible.nftId,
        nftId: parentCollectible.nftId,
        mintingTxId: mintTxId,
        parentCollectibleId: parentCollectible.id,
        fileKey: parentCollectible.fileKey,
      });

      const hasRemainingOrderItem =
        await orderItemRepository.getInQueueOrderItemByOrderIdAndType(
          order.id,
          "COLLECTIBLE"
        );
      if (!hasRemainingOrderItem) {
        await orderRepository.updateOrderStatus(order.id, "DONE");

        if (collection.status !== "CONFIRMED") {
          await collectionRepository.update(db, collection.id, {
            status: "CONFIRMED",
          });

          if (L2Collection.status !== "CONFIRMED")
            await collectionRepository.update(db, L2Collection.id, {
              status: "CONFIRMED",
            });
        }
      } else {
        //ENQUEUE ORDERID
        producer.sendMessage(order.id, 1);
      }

      return;
    }
  } else if (collection.type === "IPFS") {
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

    logger.info(`Minted NFT funded by VAULT`);
    let mintTxId = "";

    await collectibleRepository.update(db, collectible.id, {
      mintingTxId: mintTxId,
    });

    const hasRemainingOrderItem =
      await orderItemRepository.getInQueueOrderItemByOrderIdAndType(
        order.id,
        "COLLECTIBLE"
      );
    if (!hasRemainingOrderItem) {
      await orderRepository.updateOrderStatus(order.id, "DONE");

      if (collection.status !== "CONFIRMED") {
        await collectionRepository.update(db, collection.id, {
          status: "CONFIRMED",
        });
      }
    } else {
      //ENQUEUE ORDERID
      producer.sendMessage(order.id, 1);
    }

    return;
  } else throw new CustomError("Invalid collection type.", 400);
}
