const cron = require("node-cron");

export async function checkAndUpdateCollectibleStatus() {
  cron.schedule("*/5 * * * *", async () => {
    return;
  });
}
