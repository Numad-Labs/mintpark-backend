import { getInscriptionUtxosByAddress } from "../../blockchain/utxo/fractal/libs";
import { CustomError } from "../exceptions/CustomError";
import { collectibleRepository } from "../repositories/collectibleRepository";
import { userRepository } from "../repositories/userRepository";

export const collectibleServices = {
  getListableCollectibles: async (userId: string) => {
    const user = await userRepository.getById(userId);
    if (!user) throw new CustomError("User not found.", 400);

    const inscriptionUtxos = await getInscriptionUtxosByAddress(
      user.address,
      true
    );
    const inscriptionIds = inscriptionUtxos.map(
      (inscriptionUtxo) => inscriptionUtxo.inscriptions[0].inscriptionId
    );
    const listableCollectibles =
      await collectibleRepository.getListableCollectiblesByInscriptionIds(
        inscriptionIds
      );

    return listableCollectibles;
  },
};
