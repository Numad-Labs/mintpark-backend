import { collectibleRepository } from "../repositories/collectibleRepository";

const cron = require("node-cron");

export async function checkAndUpdateCollectibleStatus() {
  cron.schedule("*/5 * * * *", async () => {
    const currentDate = new Date();

    await collectibleRepository.updateExpiredOnHoldCollectibles(currentDate);

    return;
  });
}
