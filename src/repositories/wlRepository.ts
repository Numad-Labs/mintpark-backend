import { Insertable, Kysely, Transaction, Updateable } from "kysely";
import { db } from "../utils/db";
import { DB, WlAddress } from "../types/db/types";
import { LAUNCH_PHASE } from "@app-types/db/enums";

export const wlRepository = {
  getByLaunchIdAndAddressAndPhase: async (
    db: Kysely<DB> | Transaction<DB>,
    launchId: string,
    address: string,
    phase: LAUNCH_PHASE
  ) => {
    const wlAddress = await db
      .selectFrom("WlAddress")
      .selectAll()
      .where("WlAddress.launchId", "=", launchId)
      .where("WlAddress.address", "=", address.toLowerCase())
      .where("WlAddress.phase", "=", phase)
      .executeTakeFirst();

    return wlAddress;
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
  getByLaunchId: async (launchId: string) => {
    const wlAddress = await db
      .selectFrom("WlAddress")
      .selectAll()
      .where("WlAddress.launchId", "=", launchId)
      .execute();

    return wlAddress;
  }
};
