import logger from "../../src/config/winston";
import whitelist from "./holders.json";
import { launchItemRepository } from "../../src/repositories/launchItemRepository";
import { db } from "../../src/utils/db";
import { collectibleRepository } from "../../src/repositories/collectibleRepository";
import { collectionRepository } from "../../src/repositories/collectionRepository";

type WhitelistEntry = {
  address: string;
  count: number;
};

const entries: WhitelistEntry[] = whitelist;
const COLLECTION_ID = "218011b1-2cec-407c-81b9-c7c3e9a0e8c7";
const ADMIN_USER_ID = "d14e1524-a31f-48b1-b8ad-f48ca267d56b";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function airdrop() {
  for (const entry of entries) {
    // const ownedCount = undefined;
    // const nftsToOwnAfterAirdrop = entry.count * 2;
    // const nftsToMint = nftsToOwnAfterAirdrop - ownedCount;
    // if (nftsToMint < 1) {
    //   logger.info(`No NFT found to be minted: ${entry.address}`);
    //   continue;
    // }

    const nftsToMint = entry.count;

    for (let i = 1; i <= nftsToMint; i++) {
      const launchItem =
        await launchItemRepository.getRandomItemWithLockedCollectibleStatusByCollectionId(
          COLLECTION_ID
        );
      if (!launchItem) {
        logger.info(
          `No LaunchItem and Collectible found. ${entry.address}, ${i}`
        );
        continue;
      }

      const launchItemToMint = await launchItemRepository.setShortHoldById(
        db,
        launchItem.id,
        ADMIN_USER_ID
      );
      if (!launchItemToMint) {
        logger.info(
          `Could not put the item on hold: ${launchItem.id}. ${entry.address}, ${i}`
        );
        continue;
      }

      const collectible = await collectibleRepository.getById(
        db,
        launchItemToMint.collectibleId
      );
      if (!collectible || !collectible.cid) {
        logger.info(`No collectible found. ${entry.address}, ${i}`);
        continue;
      }

      const collection = await collectionRepository.getById(
        db,
        collectible.collectionId
      );
      if (!collection || !collection.contractAddress) {
        logger.info(`No collection found. ${entry.address}, ${i}`);
        continue;
      }

      //generate signature
      await sleep(200);
      //mint nft
      await sleep(300);

      //   //transfer the nft to entry.address
      //   await sleep(300);

      await collectibleRepository.update(db, collectible.id, {
        status: "CONFIRMED",
        uniqueIdx: collection.contractAddress + "i" + collectible.nftId
      });

      logger.info(`processed ${i} for ${entry.address}`);
    }
  }
}

// async function airdrop() {
//   for (const entry of entries) {
//     const nftsToMint = entry.count;

//     for (let i = 1; i <= nftsToMint; i += 10) {
//       const batchSize = Math.min(10, nftsToMint - i + 1);
//       const batch = Array.from({ length: batchSize }, (_, idx) => i + idx);

//       await Promise.all(
//         batch.map(async (batchIndex) => {
//           const launchItem =
//             await launchItemRepository.getRandomItemWithLockedCollectibleStatusByCollectionId(
//               COLLECTION_ID
//             );
//           if (!launchItem) {
//             logger.info(
//               `No LaunchItem and Collectible found. ${entry.address}, ${batchIndex}`
//             );
//             return;
//           }

//           const launchItemToMint = await launchItemRepository.setShortHoldById(
//             db,
//             launchItem.id,
//             ADMIN_USER_ID
//           );
//           if (!launchItemToMint) {
//             logger.info(
//               `Could not put the item on hold: ${launchItem.id}. ${entry.address}, index: ${batchIndex}`
//             );
//             return;
//           }

//           const collectible = await collectibleRepository.getById(
//             db,
//             launchItemToMint.collectibleId
//           );
//           if (!collectible || !collectible.cid) {
//             logger.info(
//               `No collectible found. ${entry.address}, index: ${batchIndex}`
//             );
//             return;
//           }

//           const collection = await collectionRepository.getById(
//             db,
//             collectible.collectionId
//           );
//           if (!collection || !collection.contractAddress) {
//             logger.info(
//               `No collection found. ${entry.address}, index: ${batchIndex}`
//             );
//             return;
//           }

//           //generate signature
//           await sleep(200);
//           //mint nft
//           await sleep(300);

//           await collectibleRepository.update(db, collectible.id, {
//             status: "CONFIRMED",
//             uniqueIdx: collection.contractAddress + "i" + collectible.nftId
//           });

//           logger.info(
//             `processed ${batchIndex} for ${entry.address}. nftId: ${collectible.nftId}`
//           );
//         })
//       );
//     }
//   }
// }

airdrop().then(() => {
  console.log(`Successfully processed the airdrop`);
});
