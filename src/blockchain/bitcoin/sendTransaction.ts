import axios, { AxiosError } from "axios";
import logger from "../../config/winston";

export async function sendRawTransaction(txHex: string) {
  const response = await axios.post(
    "https://mempool.space/testnet4/api/tx",
    txHex,
    {
      headers: {
        "Content-Type": "text/plain",
      },
    }
  );

  const txid = response.data;
  logger.info(`bitcoin sendRawTransaction: ${txid}, ${new Date()}`);

  return txid;
}
