import { LAYER } from "../../src/types/db/enums";
import { getUtxos } from "./fractal/libs";

export async function getUtxosHelper(
  address: string,
  isTestNet: boolean = true,
  layerType: LAYER
) {
  switch (layerType) {
    case LAYER.FRACTAL:
      const utxos = await getUtxos(address, isTestNet);
      return utxos;

    case LAYER.BITCOIN:
      throw new Error("Not implemented yet");

    case LAYER.CITREA:
      throw new Error("Not implemented yet");

    default:
      throw new Error("Invalid layer type");
  }
}
