import { ACTIVITY_TYPE } from "@app-types/db/enums";

import { db } from "@utils/db";

export const activityTypeRepository = {
  getByType: async (type: ACTIVITY_TYPE) => {
    const activityType = await db
      .selectFrom("ActivityType")
      .selectAll()
      .where("ActivityType.type", "=", type)
      .executeTakeFirst();

    return activityType;
  }
};
