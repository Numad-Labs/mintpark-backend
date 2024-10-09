import express, { NextFunction, Request, Response } from "express";
import { mintHelper } from "../libs/mintHelper";
import { SERVICE_FEE, SERVICE_FEE_ADDRESS } from "../libs/constants";
import { CustomError } from "../exceptions/CustomError";
import { deployBRC20 } from "../libs/bitcoinL1/mintBRC20";
import * as bitcoin from "bitcoinjs-lib";
import { mintCollection } from "../libs/bitcoinL1/mintCollection";

const testRouter = express.Router();

testRouter.post(
  "/mint",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        address,
        payload,
        ticker,
        headline,
        supply,
        assetType,
        mintLayerType,
        feeRate,
        fundingAddress,
        fundingPrivateKey,
      } = req.body;

      if (!address || !payload || !ticker || !headline || !supply || !assetType)
        throw new CustomError("Please provide all required fields", 400);

      const collectible = {
        address: address,
        xpub: null,
        opReturnValues: payload,
        assetType: assetType,
        headline: headline,
        ticker: ticker,
        supply: supply,
      };

      console.log(collectible);

      const result = await mintHelper({
        layerType: mintLayerType,
        feeRate: feeRate,
        mintingParams: {
          data: collectible,
          toAddress: SERVICE_FEE_ADDRESS,
          price: SERVICE_FEE,
          fundingAddress: fundingAddress,
          fundingPrivateKey: fundingPrivateKey,
        },
      });

      return res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }
);

testRouter.post(
  "/mint-collection",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        collection,
        mintLayerType,
        feeRate,
        fundingAddress,
        fundingPrivateKey,
      } = req.body;

      if (!collection || !Array.isArray(collection) || collection.length === 0)
        throw new CustomError("Please provide a valid collection", 400);

      const result = await mintCollection(
        {
          collectionData: collection,
          toAddress: SERVICE_FEE_ADDRESS,
          price: SERVICE_FEE,
          fundingAddress: fundingAddress,
          fundingPrivateKey: fundingPrivateKey,
        },
        bitcoin.networks.bitcoin,
        61
      );

      return res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }
);

testRouter.post(
  "/brc-deploy",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        brc20Ticker,
        brc20Max,
        brc20Limit,
        deployerAddress,
        fundingAddress,
        fundingPrivateKey,
      } = req.body;
      const deploymentResult = await deployBRC20(
        {
          tick: brc20Ticker,
          max: brc20Max,
          lim: brc20Limit,
          address: deployerAddress,
          fundingAddress: fundingAddress,
          fundingPrivateKey: fundingPrivateKey,
        },
        1,
        bitcoin.networks.testnet
      );
      return res.status(200).json({ success: true, data: deploymentResult });
    } catch (e) {
      next(e);
    }
  }
);

export = testRouter;
