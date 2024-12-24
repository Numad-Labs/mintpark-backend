import { Request } from "express";

export interface AuthenticatedUser {
  id: string;
  role: ROLES;
  iat: number;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export type inscriptionData = {
  address: string;
  opReturnValues: any[];
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

export type mempoolFeeRates = {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
};

export type AddressType = "p2pkh" | "p2sh" | "p2wpkh" | "p2tr";

export type rpcResponse = {
  result: string;
  error: boolean;
  id: string;
};

interface LaunchAsset {
  fileKey: string;
  metadata: {
    name: string;
    description: string;
    attributes: Array<{ trait_type: string; value: string }>;
  };
}

export interface LaunchConfig {
  collectionAddress: string;
  price: string;
  startTime: number;
  endTime: number;
  maxPerWallet: number;
  assets: LaunchAsset[];
  isWhitelisted: boolean;
  wlStartsAt?: number;
  wlEndsAt?: number;
  wlPrice?: string;
  wlMaxPerWallet?: number;
}

export type mempoolUtxo = {
  txid: string;
  vout: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
  value: number;
};
