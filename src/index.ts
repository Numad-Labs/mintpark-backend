import "module-alias/register";

import express, { Request, Response } from "express";
import { config } from "./config/config";
import helmet from "helmet";
import cors from "cors";
import { Redis } from "ioredis";
require("dotenv").config();

import userRouter from "./routes/userRoutes";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import layerRouter from "./routes/layerRoutes";
import orderRouter from "./routes/orderRoutes";
import collectionRouter from "./routes/collectionRoutes";
import collectibleRouter from "./routes/collectibleRoutes";
import collectibleTraitRouter from "./routes/collectibleTraitRoutes";
import listRouter from "./routes/listRoutes";
import launchRouter from "./routes/launchRoutes";
import logger from "./config/winston";
import { sizeLimitConstants } from "./libs/constants";
import { db } from "./utils/db";
import traitValueRouter from "./routes/traitValueRoutes";
import { version } from "../package.json";
// import { SQSConsumer } from "./queue/sqsConsumer";
// import { processMessage } from "./services/messageProcessingService";
// import { SQSProducer } from "./queue/sqsProducer";
// import { CollectionOwnerCounterService } from "./cron";
// import { QueueProcessor } from "./queue/IPFS-mint-queue";
import traitTypeRouter from "./routes/traitTypeRoutes";
import SubgraphService from "@blockchain/evm/services/subgraph/subgraphService";
import { MarketplaceSyncService } from "@blockchain/evm/services/subgraph/marketplaceSyncService";

export const redis = new Redis(config.REDIS_CONNECTION_STRING);

const app = express();

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    message: `API ${version} - 👋🌎🌍`
  });
});

// // Get environment variables
// const isProduction = process.env.NODE_ENV === "production";
// const corsOptions = {
//   origin: isProduction
//     ? "https://mintpark.io"
//     : ["http://localhost:3000", "http://127.0.0.1:3000"]
// };

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: sizeLimitConstants.jsonSizeLimit }));
app.use(
  express.urlencoded({
    limit: sizeLimitConstants.formDataSizeLimit,
    extended: true
  })
);
// app.use(rateLimiter);

app.use("/api/v1/users", userRouter);
app.use("/api/v1/layers", layerRouter);
app.use("/api/v1/orders", orderRouter);
app.use("/api/v1/collections", collectionRouter);
app.use("/api/v1/trait-values", traitValueRouter);
app.use("/api/v1/trait-types", traitTypeRouter);
app.use("/api/v1/collectibles", collectibleRouter);
app.use("/api/v1/collectible-traits", collectibleTraitRouter);
app.use("/api/v1/lists", listRouter);
app.use("/api/v1/launchpad", launchRouter);

app.use(notFound);
app.use(errorHandler);

// const collectionOwnerCounterService = new CollectionOwnerCounterService();
// collectionOwnerCounterService.startScheduler().catch(logger.error);
const subgraphService = new SubgraphService();
const marketplaceSyncService = new MarketplaceSyncService(db, subgraphService);
app.locals.marketplaceSyncService = marketplaceSyncService;

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
    // queueProcessor.stop();
    // consumer.stop();
    // await collectionOwnerCounterService.stopHeartbeat();

    logger.info("Cleanup successful");
    process.exit(0);
  } catch (err) {
    logger.error("Error during cleanup:", err);
    process.exit(1);
  }
}
