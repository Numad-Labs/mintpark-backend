import { Message } from "@aws-sdk/client-sqs";
import { CustomError } from "../exceptions/CustomError";
import logger from "../config/winston";
import { orderRepository } from "../repositories/orderRepostory";
import { z } from "zod";

export const orderIdSchema = z.string().uuid();

export async function processMessage(message: Message) {
  if (!message.Body) throw new CustomError("Invalid message body.", 400);
  const isValidMessage = orderIdSchema.safeParse(message.Body);
  if (!isValidMessage.success)
    throw new CustomError(`Invalid orderId: ${message.Body}`, 400);

  const order = await orderRepository.getById(isValidMessage.data);
  if (!order) throw new CustomError(`Order not found: ${message.Body}`, 400);
  if (
    !(
      order.orderType === "MINT_COLLECTIBLE" ||
      order.orderType === "MINT_RECURSIVE_COLLECTIBLE"
    )
  )
    throw new CustomError("Order with invalid order type.", 400);

  if (order.orderType === "MINT_COLLECTIBLE") {
  }

  logger.info(`Processing order: ${order}`);
}
