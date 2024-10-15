import express, { Request, Response } from "express";
import { config } from "./config/config";
import bodyParser from "body-parser";
import helmet from "helmet";
import cors from "cors";
import { Redis } from "ioredis";
require("dotenv").config();

import userRouter from "./routes/userRoutes";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import { checkAndUpdateCollectibleStatus } from "./cron";
import layerRouter from "./routes/layerRoutes";
import orderRouter from "./routes/orderRoutes";

export const redis = new Redis(config.REDIS_CONNECTION_STRING);

const app = express();

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    message: "API - 👋🌎🌍🌏",
  });
});

app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(bodyParser.json());

app.use("/api/v1/users", userRouter);
app.use("/api/v1/layers", layerRouter);
app.use("/api/v1/orders", orderRouter);

app.use(errorHandler);
app.use(notFound);

app.listen(config.PORT, () => {
  console.log(`Server has started on port ${config.PORT}`);
});
