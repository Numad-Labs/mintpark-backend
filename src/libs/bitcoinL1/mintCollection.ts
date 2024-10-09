import * as bitcoin from "bitcoinjs-lib";
import { tokenData, unisatUtxo } from "../../../custom";
import { mintForBitcoin } from "./mintCollectible";
import { getUtxosWithAddress, selectUtxos } from "./libs";
import { CustomError } from "../../exceptions/CustomError";

export async function mintCollection(
  params: {
    collectionData: tokenData[];
    toAddress: string;
    price: number;
    fundingAddress: string;
    fundingPrivateKey: string;
  },
  network: bitcoin.networks.Network = bitcoin.networks.testnet,
  feeRate: number
) {
  const {
    collectionData,
    toAddress,
    price,
    fundingAddress,
    fundingPrivateKey,
  } = params;

  // Calculate total required amount
  const totalPrice = price * collectionData.length;
  const estimatedFeePerMint = 10000; // Adjust this based on your average minting fee
  const totalEstimatedFee = estimatedFeePerMint * collectionData.length;
  const requiredAmount = totalPrice + totalEstimatedFee;

  // Get and select UTXOs
  const utxos: unisatUtxo[] = await getUtxosWithAddress(
    fundingAddress,
    network
  );
  if (!utxos || utxos.length === 0)
    throw new CustomError("Not funded. Utxos not found.", 400);

  const selectedUtxos = selectUtxos(utxos, requiredAmount);

  // Mint each item in the collection
  const mintResults = [];
  for (const item of collectionData) {
    try {
      const result = await mintForBitcoin(
        {
          data: item,
          toAddress,
          price: price,
          fundingAddress,
          fundingPrivateKey,
        },
        network,
        feeRate
      );
      mintResults.push(result);
    } catch (error) {
      console.error(`Error minting item: ${item.ticker}`, error);
      // Optionally, you can choose to continue minting other items or throw an error here
    }
  }

  return {
    collectionSize: collectionData.length,
    mintedItems: mintResults.length,
    mintResults,
  };
}
