import { Prisma } from "@prisma/client";
import { Request } from "express";

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

export type AddressType = "p2pkh" | "p2sh" | "p2wpkh" | "p2tr";

export type rpcResponse = {
  result: string;
  error: boolean;
  id: string;
};
