// controllers/launchpadController.ts
import { NextFunction, Request, Response } from "express";
import MarketplaceService from "../services/marketplaceService";
import { EVM_CONFIG } from "../evm-config";
import LaunchpadService from "../services/launchpadService";
import { serializeBigInt } from "../utils";
import { ethers } from "ethers";
import { db } from "../../../src/utils/db";
import { Insertable } from "kysely";
import { Collectible } from "../../../src/types/db/types";
// import { Launch } from "@prisma/client";
// import { LaunchItem, Timestamp } from "../../../src/types/db/types";
type LAUNCH_ITEM_STATUS = "ACTIVE" | "ON_HOLD" | "SOLD" | "CANCELLED";

export interface LaunchItemTypes {
  id: string;
  launchId: string;
  fileKey: string;
  metadata: unknown | null;
  status: LAUNCH_ITEM_STATUS;
  evmAssetId: string | null;
  name: string | null;
}

export interface Launchtype {
  id: string;
  collectionId: string;
  isWhitelisted: boolean;
  wlStartsAt: number | null; // timestamp in milliseconds
  wlEndsAt: number | null; // timestamp in milliseconds
  wlMintPrice: number | null;
  wlMaxMintPerWallet: number | null;
  poStartsAt: number; // timestamp in milliseconds
  poEndsAt: number; // timestamp in milliseconds
  poMintPrice: number;
  poMaxMintPerWallet: number;
}

// Mock Data
const mockLaunches: Launchtype[] = [
  {
    id: "launch-1",
    collectionId: "0x1234567890123456789012345678901234567890",
    isWhitelisted: true,
    wlStartsAt: new Date("2024-10-24").getTime(),
    wlEndsAt: new Date("2024-10-26").getTime(),
    wlMintPrice: 0.1,
    wlMaxMintPerWallet: 2,
    poStartsAt: new Date("2024-10-27").getTime(),
    poEndsAt: new Date("2024-10-30").getTime(),
    poMintPrice: 0.2,
    poMaxMintPerWallet: 5,
  },
  {
    id: "launch-2",
    collectionId: "0x9876543210987654321098765432109876543210",
    isWhitelisted: false,
    wlStartsAt: null,
    wlEndsAt: null,
    wlMintPrice: null,
    wlMaxMintPerWallet: null,
    poStartsAt: new Date("2024-11-01").getTime(),
    poEndsAt: new Date("2024-11-05").getTime(),
    poMintPrice: 0.15,
    poMaxMintPerWallet: 3,
  },
];

const mockLaunchItems: LaunchItemTypes[] = [
  {
    id: "item-1",
    launchId: "launch-1",
    fileKey: "ipfs://Qm...",
    metadata: {
      name: "NFT #1",
      description: "First NFT in the collection",
      image: "ipfs://Qm...",
    },
    status: "ACTIVE",
    evmAssetId: "1",
    name: "NFT #1",
  },
  {
    id: "item-2",
    launchId: "launch-1",
    fileKey: "ipfs://Qm...",
    metadata: {
      name: "NFT #2",
      description: "Second NFT in the collection",
      image: "ipfs://Qm...",
    },
    status: "ACTIVE",
    evmAssetId: null,
    name: "NFT #2",
  },
];

const launchPadService = new LaunchpadService(
  EVM_CONFIG.RPC_URL,
  new MarketplaceService(EVM_CONFIG.MARKETPLACE_ADDRESS)
);

export const createLaunchpadListing = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { launchConfig, ownerAddress, totalSupply } = req.body;

    // Validate input
    if (!launchConfig || !ownerAddress || !totalSupply) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required parameters: launchConfig, ownerAddress, or totalSupply",
      });
    }

    // Validate launchConfig fields
    const requiredFields = [
      "collectionAddress",
      "startTime",
      "endTime",
      "price",
      "isWhitelisted",
    ];
    for (const field of requiredFields) {
      if (!(field in launchConfig)) {
        return res.status(400).json({
          success: false,
          error: `Missing required field in launchConfig: ${field}`,
        });
      }
    }

    const unsignedTx = await launchPadService.createLaunchpadListingWithAssets(
      launchConfig,
      ownerAddress,
      totalSupply
    );

    // Serialize BigInt values before sending the response
    const serializedTx = serializeBigInt(unsignedTx);

    res.json({ success: true, unsignedTransaction: serializedTx });
  } catch (e) {
    next(e);
  }
};

export const createLaunchpadContractFeeChange = () => {};

// Get launch by ID
const getLaunchById = async (id: string): Promise<Launchtype | null> => {
  const launch = mockLaunches.find((launch) => launch.id === id);
  if (!launch) return null;
  return launch;
};

const getLaunchItems = async (launchId: string): Promise<LaunchItemTypes[]> => {
  return mockLaunchItems.filter((item) => item.launchId === launchId);
};

export const getLaunchpadMintTransaction = async (
  launchId: string,
  buyer: string,
  collectionAddress: string
): Promise<ethers.TransactionRequest> => {
  const launch = await getLaunchById(launchId);
  if (!launch) {
    throw new Error("Launch not found");
  }

  //TODO: FIX DG
  // const launchItems = await getLaunchItems(launchId);
  // if (launchItems.length === 0) {
  //   throw new Error("No items found for this launch");
  // }

  const pickedCollectible: Insertable<Collectible> = {
    name: "",
    collectionId: "",
  };

  const unsignedTx = await launchPadService.getUnsignedLaunchMintTransaction(
    /* launchItems, */
    pickedCollectible,
    buyer,
    collectionAddress,
    db
  );
  // Serialize BigInt values before sending the response
  const serializedTx = serializeBigInt(unsignedTx);
  return serializedTx;
};
