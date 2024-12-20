import express, { Request, Response } from "express";
import { config } from "./config/config";
import helmet from "helmet";
import cors from "cors";
import { Redis } from "ioredis";
require("dotenv").config();

import userRouter from "./routes/userRoutes";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
// import {
//   checkAndUpdateCollectibleStatus,
//   checkPaymentAndUpdateOrderStatus,
//   mintingQueue,
// } from "./cron";
import layerRouter from "./routes/layerRoutes";
import orderRouter from "./routes/orderRoutes";
import collectionRouter from "./routes/collectionRoutes";
import collectibleRouter from "./routes/collectibleRoutes";
import collectibleTraitRouter from "./routes/collectibleTraitRoutes";
import listRouter from "./routes/listRoutes";
import launchRouter from "./routes/launchRoutes";
// import nftRouter from "../blockchain/evm/routes/nftRoutes";
import logger from "./config/winston";
import { sizeLimitConstants } from "./libs/constants";
import { rateLimiter } from "./middlewares/rateLimiter";
import { db } from "./utils/db";
import traitValueRouter from "./routes/traitValueRoutes";
import { version } from "../package.json";
import { SQSConsumer } from "./queue/sqsConsumer";
import { processMessage } from "./services/messageProcessingService";
import { SQSProducer } from "./queue/sqsProducer";
import { CollectionOwnerCounterService } from "./cron";

export const redis = new Redis(config.REDIS_CONNECTION_STRING);

const app = express();

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    message: `API ${version} - 👋🌎🌍🌏`,
  });
});

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: sizeLimitConstants.jsonSizeLimit }));
app.use(
  express.urlencoded({
    limit: sizeLimitConstants.formDataSizeLimit,
    extended: true,
  })
);
// app.use(rateLimiter);

app.use("/api/v1/users", userRouter);
app.use("/api/v1/layers", layerRouter);
app.use("/api/v1/orders", orderRouter);
app.use("/api/v1/collections", collectionRouter);
app.use("/api/v1/trait-values", traitValueRouter);
app.use("/api/v1/collectibles", collectibleRouter);
app.use("/api/v1/collectible-traits", collectibleTraitRouter);
app.use("/api/v1/lists", listRouter);
app.use("/api/v1/launchpad", launchRouter);
// app.use("/api/v1/evm", nftRouter);

app.use(notFound);
app.use(errorHandler);

const consumer = new SQSConsumer(
  "eu-central-1",
  "https://sqs.eu-central-1.amazonaws.com/992382532523/test-queue"
);
logger.info("Starting SQS consumer...");
consumer.start(processMessage);

export const producer = new SQSProducer(
  "eu-central-1",
  "https://sqs.eu-central-1.amazonaws.com/992382532523/test-queue"
);

const collectionOwnerCounterService = new CollectionOwnerCounterService();
collectionOwnerCounterService.startScheduler().catch(logger.error);

app.listen(config.PORT, () => {
  logger.info(`Server has started on port ${config.PORT}`);
});

process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);

async function cleanup() {
  logger.info("Received shutdown signal, cleaning up...");
  try {
    await db.destroy();
    await redis.disconnect();
    consumer.stop();
    await collectionOwnerCounterService.stopHeartbeat();

    logger.info("Cleanup successful");
    process.exit(0);
  } catch (err) {
    logger.error("Error during cleanup:", err);
    process.exit(1);
  }
}
