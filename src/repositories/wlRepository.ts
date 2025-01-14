import { Insertable, Updateable } from "kysely";
import { db } from "../utils/db";
import { WlAddress } from "../types/db/types";

export const wlRepository = {
  getByLaunchIdAndAddress: async (launchId: string, address: string) => {
    const user = await db
      .selectFrom("WlAddress")
      .selectAll()
      .where("WlAddress.launchId", "=", launchId)
      .where("WlAddress.address", "=", address)
      .execute();

    return user;
  },
  bulkInsert: async (addresses: Insertable<WlAddress>[]) => {
    const wlAddress = await db
      .insertInto("WlAddress")
      .values(addresses)
      .returningAll()
      .executeTakeFirstOrThrow(
        () => new Error("Could not create the wl address.")
      );

    return wlAddress;
  },
};
