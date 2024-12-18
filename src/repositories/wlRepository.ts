import { Insertable, Updateable } from "kysely";
import { db } from "../utils/db";
import { WlAddress } from "../types/db/types";

export const wlRepository = {
  getByLaunchId: async (launchId: string) => {
    const user = await db
      .selectFrom("WlAddress")
      .selectAll()
      .where("WlAddress.launchId", "=", launchId)
      .execute();

    return user;
  },
};
