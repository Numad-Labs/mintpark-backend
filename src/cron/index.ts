import { collectibleRepository } from "../repositories/collectibleRepository";
import { orderRepository } from "../repositories/orderRepository";
const cron = require("node-cron");

export async function checkAndUpdateCollectibleStatus() {
  cron.schedule("0 * * * *", async () => {
    const currentDate = new Date();

    await collectibleRepository.updateExpiredOnHoldCollectibles(currentDate);

    return;
  });
}

export async function checkAndUpdateOrderStatus() {
  cron.schedule("0 * * * *", async () => {
    try {
      console.log("Updating order status...");
      const cutoffDate = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      const updatedOrders = await orderRepository.updateExpiredOrderStatus(
        cutoffDate
      );
      console.log(`Updated ${updatedOrders.length} orders`);
    } catch (error) {
      console.error("Error in cron job:", error);
    }
  });
}
