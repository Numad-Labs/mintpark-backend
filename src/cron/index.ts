import { collectibleRepository } from "../repositories/collectibleRepository";
import { orderRepository } from "../repositories/orderRepository";
const cron = require("node-cron");

export async function checkAndUpdateCollectibleStatus() {
  cron.schedule("*/5 * * * *", async () => {
    const currentDate = new Date();

    await collectibleRepository.updateExpiredOnHoldCollectibles(currentDate);

    return;
  });
}

export async function checkAndUpdateOrderStatus() {
  cron.schedule("*/1 * * * *", async () => {
    // Update order status
    const currentDate = new Date();
    await orderRepository.updateExpiredOrderStatus(currentDate);
    return;
  });
}
