import { LAYER } from "../../src/types/db/enums";
import { verifySignedMessageFractal } from "../../blockchain/utxo/fractal/verifyMessage";
import { layerRepository } from "../../src/repositories/layerRepository";

export async function verifySignedMessage(
  originalMessage: string,
  signedMessage: string,
  address: string,
  layerId: string
) {
  const layer = await layerRepository.getById(layerId);

  console.log(layer);

  if (!layer) throw new Error("Layer not found.");
  switch (layer.layer) {
    case LAYER.FRACTAL:
      return verifySignedMessageFractal(
        originalMessage,
        signedMessage,
        address
      );
    default:
      throw new Error("Layer not supported.");
  }
}
