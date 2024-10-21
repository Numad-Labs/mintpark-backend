import express from "express";

import {
  getDeploymentTransaction,
  getMintNFTTransaction,
  getListNFTTransaction,
} from "../controller/newNftController";

const nftRouter = express.Router();

nftRouter.post("/deploy-collection", getDeploymentTransaction);
nftRouter.post("/mint", getMintNFTTransaction);
nftRouter.post("/list", getListNFTTransaction);

export = nftRouter;
