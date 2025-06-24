import { Router } from "express";
import {
  authenticateToken,
  verifyMarketplaceSyncSecret
} from "../middlewares/authenticateToken";
import { listController } from "../controllers/listController";
import { authorize } from "../middlewares/authorize";
const listRouter = Router();

listRouter.post("/", authenticateToken, listController.listCollectible);
listRouter.post(
  "/approval",
  authenticateToken,
  listController.generateApprovelTransactionOfTrading
);
listRouter.post(
  "/checkRegistration",
  authenticateToken,
  listController.checkRegistration
);

listRouter.post(
  "/:id/confirm",
  authenticateToken,
  listController.confirmPendingList
);
listRouter.post(
  "/:id/generate-hex",
  authenticateToken,
  listController.generateTxHexToBuyListedCollectible
);
listRouter.post(
  "/:id/buy",
  authenticateToken,
  listController.buyListedCollectible
);
listRouter.post(
  "/:id/generate-cancel-listing-tx",
  authenticateToken,
  listController.generateCancelListingTx
);
listRouter.post(
  "/:id/confirm-cancel-listing",
  authenticateToken,
  listController.confirmCancelListingTx
);

/**
 * @route   GET /api/marketplace/activity
 * @desc    Get all marketplace activities (LISTED, SOLD, CANCELED)
 * @access  Public
 * @query   {
 *            chainId: number,
 *            limit: number,
 *            offset: number,
 *            sortBy: string,
 *            sortDirection: 'asc' | 'desc'
 *            activityType: "CREATED", "SOLD", "CANCELLED"
 *          }
 */
listRouter.get("/activity", listController.getMarketplaceActivity);
/**
 * @route   GET /api/marketplace/listing/:listingId
 * @desc    Get listing information by ID
 * @access  Public
 * @params  listingId
 * @query   {
 *            chainId: number
 *          }
 */
listRouter.get("/:listingId", listController.getListingById);

/**
 * @route   GET /api/marketplace/token/:nftContract/:tokenId/activity
 * @desc    Get activities for a specific NFT token
 * @access  Public
 * @params  nftContract, tokenId
 * @query   {
 *            chainId: number,
 *            limit: number,
 *            offset: number,
 *            sortBy: string,
 *            sortDirection: 'asc' | 'desc'
 *          }
 */
listRouter.get(
  "/token/:nftContract/:tokenId/activity",
  listController.getTokenActivity
);

/**
 * @route   POST /api/marketplace/sync
 * @desc    Manually trigger marketplace data sync
 */
listRouter.post(
  "/sync",
  verifyMarketplaceSyncSecret,
  listController.syncMarketplace
);

// listRouter.get(
//   "/:id/estimate-fee",
//   authenticateToken,
//   listController.getEstimatedFee
// );

export = listRouter;
