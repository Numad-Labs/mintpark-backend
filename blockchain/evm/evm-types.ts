export enum NFTActivityType {
  MINTED = "MINTED",
  LISTED = "LISTED",
  SALE = "SALE",
  TRANSFER = "TRANSFER",
  LISTING_CANCELED = "LISTING_CANCELED",
  MINT_BATCH = "MINT_BATCH",
  PRICE_UPDATED = "PRICE_UPDATED",
  APPROVAL = "APPROVAL",
}

export interface NFTActivity {
  activityType: NFTActivityType;
  tokenId: string | null;
  collectionId: string;
  fromAddress: string;
  toAddress?: string;
  price?: string;
  transactionHash: string;
  timestamp: number;
  blockNumber: number;
}
