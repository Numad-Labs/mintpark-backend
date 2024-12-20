import { Router } from "express";
import { authenticateToken } from "../../../src/middlewares/authenticateToken";
// import { evmAssetController } from "../controller/assetController";
import { userController } from "../controller/evmUserController";

const evmRoutes = Router();

// // Collection routes
// evmRoutes.post("/collections/deploy", evmAssetController.deployCollection);
// evmRoutes.post(
//   "/collections/:address/mint",
//   evmAssetController.mintCollectible
// );

// // Marketplace interaction routes
// evmRoutes.post("/marketplace/list", evmAssetController.listAsset);
// evmRoutes.post("/marketplace/buy", evmAssetController.buyAsset);

evmRoutes.post("/generate-message", userController.generateMessageToSign);
// evmRoutes.post("/login", userController.login);

export = evmRoutes;
