import { tokenData } from "../custom";
import { config } from "./config/config";
import {
  ASSETTYPE,
  DEFAULT_FEE_RATE,
  SERVICE_FEE,
  SERVICE_FEE_ADDRESS,
} from "../blockchain/utxo/constants";
import {
  getUtxos,
  sendRawTransactionWithNode,
} from "../blockchain/utxo/fractal/libs";
import { mint } from "../blockchain/utxo/fractal/mint";

function testRun() {
  console.log("Test run");
}

function configTest() {
  console.log("Fractal API Key:", config.UNISAT_FRACTAL_TESTNET_API_KEY);
}

async function main() {
  testRun();

  try {
    // const utxos = await getUtxos(
    //   "bc1qzr9zqc5d7zj7ktxnfdeueqmxwfwdvrmedckckd",
    //   true
    // );
    // console.log(utxos);

    // const tokenData: tokenData = {
    //   address: "bc1pffk5397d7sns6mayud03nf3fxy4p04e3alhslr6epaq3a788tsuqkxg0rn",
    //   xpub: null,
    //   opReturnValues:
    //     "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAD0GVYSWZNTQAqAAAACAACARIAAwAAAAEAAQAAkoYAAgAAA6oAAAAmAAAAAHsibmFtZSI6ICJIb25leSBCYWRnZXJzIiwgImRlc2NyaXB0aW9uIjogIkhvbmV5IEJhZGdlcnMgaXMgYSBnZW5lcmF0aXZlIDEwayBQRlAgY29sbGVjdGlvbiBpbnNjcmliZWQgb24gdGhlIEJpdGNvaW4gQmxvY2tjaGFpbiB0aHJvdWdoIE9yZGluYWxzLiBJdCBpcyBhbiBleHBlcmltZW50IHRvIHNlZSBpZiBhIG5hdGl2ZSBORlQgY29tbXVuaXR5IGNhbiBlbWVyZ2UgYW5kIHRocml2ZSBvbiB0aGUgbmF0aXZlIEJpdGNvaW4gZWNvc3lzdGVtLiBUaGUgcHJvamVjdCBkb2Vzblx1MjAxOXQgaGF2ZSBhIHJvYWRtYXAgYW5kIGl0cyBzb2xlbHkgcHVycG9zZSBpcyB0byBkZWxpdmVyIGhpZ2ggcXVhbGl0eSBwaXhlbGF0ZWQgYXJ0IGFuZCBhIGZ1biBwbGFjZSB0byBoYW5nIG91dCB3aXRoIGZyaWVuZHMuIFRoZSBjb2xsZWN0aW9uIGlzIEJpdGNvaW4gdGhlbWVkIHdpdGggdGhlIGhvbmV5IGJhZGdlciBtZW1lIGJlaW5nIHRoZSBjZW50ZXIgb2YgaXQsIGJ1dCBhbHNvIGhhcyBtYW55IG90aGVyIHRyYWl0cyByZWxhdGVkIHRvIGNyeXB0byBhbmQgc3BlY2lmaWNhbGx5IHRoZSBCaXRjb2luIGN1bHR1cmUuIiwgImNyZWF0b3IiOiAiSG9uZXkgQmFkZ2VycyBUZWFtIiwgImF0dHJpYnV0ZXMiOiBbeyJ0cmFpdF90eXBlIjogIkJhY2tncm91bmQiLCAidmFsdWUiOiAicGluayJ9LCB7InRyYWl0X3R5cGUiOiAiQm9keSIsICJ2YWx1ZSI6ICJ0aWdlciJ9LCB7InRyYWl0X3R5cGUiOiAiTWFuZSIsICJ2YWx1ZSI6ICJ3aGl0ZSJ9LCB7InRyYWl0X3R5cGUiOiAiQ2xhd3MiLCAidmFsdWUiOiAiYmxvb2R5In0sIHsidHJhaXRfdHlwZSI6ICJFeWVzIiwgInZh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" as any,
    //   assetType: ASSETTYPE.NFTONCHAIN,
    //   headline: "headline",
    //   ticker: "test",
    //   supply: 1,
    // };
    // const mintHexes = await mint(
    //   tokenData,
    //   "bc1pffk5397d7sns6mayud03nf3fxy4p04e3alhslr6epaq3a788tsuqkxg0rn",
    //   "8736c95006362c182c82fa937eaab90c1a7dfc6057402fd83a7c89f557fdd770",
    //   true,
    //   SERVICE_FEE_ADDRESS.FRACTAL_TESTNET,
    //   SERVICE_FEE,
    //   DEFAULT_FEE_RATE,
    //   "bc1pffk5397d7sns6mayud03nf3fxy4p04e3alhslr6epaq3a788tsuqkxg0rn",
    //   1000
    // );
    // const commitTxId = await sendRawTransactionWithNode(mintHexes.commitTxHex, true);
    // console.log("Commit Tx ID:", commitTxId);

    // const revealTxId = await sendRawTransactionWithNode(mintHexes.revealTxHex, true);
    // console.log("Reveal Tx ID:", revealTxId);
  } catch (error) {
    console.log(error);
  }
}

main();
