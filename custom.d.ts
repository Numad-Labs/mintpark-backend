import { LAYER_TYPE, Prisma } from "@prisma/client";
import { Request } from "express";
import { MINT_LAYER_TYPE } from "./src/libs/constants";

export interface AuthenticatedRequest extends Request {
  user?: Prisma.UserCreateInput;
}

export type tokenData = {
  xpub: string | null;
  address: string;
  opReturnValues: any[];
  assetType: number;
  headline: string;
  ticker: string;
  supply: number;
};

// export type collectionData = {
//   address: string;
//   opReturnValues: any[];
//   assetType: number;
//   headline: string;
//   ticker: string;
//   supply: number;
//   traits: Attribute[];
//   //traits optional, logo optional
// };

export type utxo = {
  txid: string;
  vout: number;
  value: number;
  coinbase: boolean;
  height: number;
  derviation_index: number;
  confirmations: number;
};

export type unisatUtxo = {
  address: string;
  height: number;
  idx: number;
  inscriptions: any[]; // Adjust the type of inscriptions if necessary
  isOpInRBF: boolean;
  isSpent: boolean;
  satoshi: number;
  scriptPk: string;
  scriptType: string;
  txid: string;
  vout: number;
};

export type rpcResponse = {
  result: string;
  error: boolean;
  id: string;
};

export type inscriptionData = {
  imageBuffer: Buffer;
  contentType: string;
  supply: number | null;
  revealAddr: string | null;
};

export type mintingParams = {
  layerType: LAYER_TYPE;
  feeRate: number;
  mintingParams: {
    data: tokenData;
    toAddress: string;
    price: number;
    fundingAddress: string;
    fundingPrivateKey: string;
  };
};

export interface MintingParams {
  layerType: LAYER_TYPE;
  feeRate: number;
  mintingParams:
    | BRC20MintingParams
    | CollectibleMintingParams
    | CollectionMintingParams;
}

export interface BRC20MintingParams {
  type: "BRC20";
  operation: "DEPLOY" | "MINT" | "TRANSFER";
  ticker: string;
  amount?: string;
  decimals?: number;
  supply?: string;
  limit?: string;
  to?: string;
}

export interface CollectibleMintingParams {
  type: "COLLECTIBLE";
  metadata: {
    name?: string;
    creator?: string;
    description?: string;
    image: string | Buffer;
    attributes: ?Array<{ trait_type: string; value: string }>;
  };
}

export interface CollectionMintingParams {
  type: "COLLECTION";
  collectionMetadata: {
    name: string;
    description: string;
    creator?: string;
    collection_logo: string | Buffer;
  };
  items: Array<NFTMintingParams>;
}
