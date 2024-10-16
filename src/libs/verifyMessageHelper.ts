import { LAYER } from "../types/db/enums";
import { verifySignedMessageFractal } from "../../blockchain/fractal/verifyMessage";
import { layerRepository } from "../repositories/layerRepository";

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
