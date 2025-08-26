// holdingMultiplierService.ts
import { collectionRepository } from "@repositories/collectionRepository";
import { layerRepository } from "@repositories/layerRepository";
// import { EVMCollectibleService } from "@services/evmCollectibleService";
import { EVMCollectibleService } from "@blockchain/evm/services/evmIndexService";
import { EVM_CONFIG } from "@blockchain/evm/evm-config";
// import { EVM_CONFIG } from "@config/chains";
import logger from "@config/winston";
import { userRepository } from "@repositories/userRepository";
import { MULTIPLIER_COLLECTIONS } from "@libs/constants";

// Special collections & their multipliers

export async function getPointMultiplier(address: string): Promise<number> {
  let multiplier = 1;

  for (const [chainIdStr, contracts] of Object.entries(
    MULTIPLIER_COLLECTIONS
  )) {
    const chainId = Number(chainIdStr);
    const chainConfig = EVM_CONFIG.CHAINS[chainId];

    if (!chainConfig) {
      logger.warn(`Chain config not found for chainId ${chainId}`);
      continue;
    }

    try {
      const evmCollectibleService = new EVMCollectibleService(
        chainConfig.RPC_URL
      );
      const validContracts = Object.keys(contracts);
      const tokenResults = await evmCollectibleService.processCollections(
        validContracts,
        address
      );

      for (const [contractAddress, tokenIds] of Object.entries(tokenResults)) {
        if (tokenIds.length && contracts[contractAddress]) {
          const factor = contracts[contractAddress];

          multiplier *= factor;
          // or if you prefer strongest only:
          // multiplier = Math.max(multiplier, factor);

          logger.info(
            `User ${address} holds tokens in ${contractAddress} on chain ${chainId}, multiplier *= ${factor}`
          );
        }
      }
    } catch (err) {
      logger.error(`Error checking holdings for chainId ${chainId}: ${err}`);
    }
  }

  return multiplier;
}
