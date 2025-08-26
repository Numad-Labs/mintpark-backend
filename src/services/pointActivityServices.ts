import { ACTIVITY_TYPE, NETWORK } from "@app-types/db/enums";
import logger from "@config/winston";
import { activityTypeRepository } from "@repositories/activityTypeRepository";
import { pointActivityRepository } from "@repositories/pointActivityRepository";

export const pointActivityServices = {
  award: async (
    { userLayerId, address }: { userLayerId: string; address: string },
    type: ACTIVITY_TYPE,
    { purchaseId, listId }: { purchaseId?: string; listId?: string },
    network: NETWORK
  ) => {
    if (
      (!purchaseId && type === "MINT") ||
      (!listId && (type === "LIST" || type === "BUY" || type === "SELL"))
    ) {
      logger.error(
        `Invalid input provided to award method: type: ${type} listId: ${listId}, purchaseId: ${purchaseId}`
      );
      return;
    }

    if (network !== "MAINNET") return;

    // if holding --> Hemi Bros || Mintpark Genesis, multiplier += 0.2...
    let multiplier = 1;

    const activityType = await activityTypeRepository.getByType(type);
    if (!activityType) {
      logger.error(`Activity type not found on award`);
      return;
    }

    // exactly 1 decimal place
    const roundedPoint = Math.round(activityType.point * multiplier * 10) / 10;

    await pointActivityRepository.create({
      userLayerId,
      activityTypeId: activityType.id,
      awardedPoints: roundedPoint,
      multiplier,

      purchaseId: purchaseId,
      listId: listId
    });
  }
};
