import { Insertable, Kysely, Transaction, Updateable } from "kysely";
import { db } from "../utils/db";
import { DB, User } from "../types/db/types";

export const userRepository = {
  create: async (data: Insertable<User>) => {
    const user = await db
      .insertInto("User")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow(() => new Error("Couldnt create the user."));

    return user;
  },
  update: async (id: string, data: Updateable<User>) => {
    const user = await db
      .updateTable("User")
      .returningAll()
      .set(data)
      .where("User.id", "=", id)
      .executeTakeFirstOrThrow(() => new Error("Couldnt update the user."));

    return user;
  },
  delete: async (id: string) => {
    const user = await db
      .deleteFrom("User")
      .returningAll()
      .where("User.id", "=", id)
      .executeTakeFirstOrThrow(() => new Error("Couldnt delete the user."));

    return user;
  },
  getById: async (id: string) => {
    const user = await db
      .selectFrom("User")
      .selectAll()
      .where("User.id", "=", id)
      .executeTakeFirst();

    return user;
  },
  getByAddressAndLayerId: async (address: string, layerId: string) => {
    const user = await db
      .selectFrom("User")
      .innerJoin("UserLayer", "UserLayer.userId", "User.id")
      .innerJoin("Layer", "Layer.id", "UserLayer.layerId")
      .select([
        "User.id",
        "User.role",
        "User.createdAt",
        "UserLayer.layerId",
        "UserLayer.address",
        "UserLayer.pubkey",
        "UserLayer.xpub",
        "Layer.layer",
        "Layer.network"
      ])
      .where("UserLayer.address", "=", address)
      .where("UserLayer.layerId", "=", layerId)
      .executeTakeFirst();

    return user;
  },
  getByIdAndLayerId: async (id: string, layerId: string) => {
    const user = await db
      .selectFrom("User")
      .innerJoin("UserLayer", "UserLayer.userId", "User.id")
      .innerJoin("Layer", "Layer.id", "UserLayer.layerId")
      .select([
        "User.id",
        "User.role",
        "User.createdAt",
        "UserLayer.layerId",
        "UserLayer.address",
        "UserLayer.pubkey",
        "UserLayer.xpub",
        "Layer.layer",
        "Layer.network",
        "UserLayer.isActive"
      ])
      .where("User.id", "=", id)
      .where("UserLayer.layerId", "=", layerId)
      .executeTakeFirst();

    return user;
  },
  getByUserLayerId: async (userLayerId: string) => {
    const user = await db
      .selectFrom("User")
      .innerJoin("UserLayer", "UserLayer.userId", "User.id")
      .innerJoin("Layer", "Layer.id", "UserLayer.layerId")
      .select([
        "User.id",
        "User.role",
        "User.createdAt",
        "UserLayer.layerId",
        "UserLayer.address",
        "UserLayer.pubkey",
        "UserLayer.xpub",
        "Layer.layer",
        "Layer.network",
        "Layer.chainId",
        "UserLayer.isActive"
      ])
      .where("UserLayer.id", "=", userLayerId)
      .executeTakeFirst();

    return user;
  },
  getActiveAccountsByUserId: async (userId: string) => {
    const accounts = await db
      .selectFrom("User")
      .innerJoin("UserLayer", "UserLayer.userId", "User.id")
      .innerJoin("Layer", "Layer.id", "UserLayer.layerId")
      .select([
        "User.id",
        "User.role",
        "User.createdAt",
        "UserLayer.layerId",
        "UserLayer.address",
        "UserLayer.pubkey",
        "UserLayer.xpub",
        "Layer.layer",
        "Layer.network"
      ])
      .where("UserLayer.userId", "=", userId)
      .where("UserLayer.isActive", "=", true)
      .execute();

    return accounts;
  },
  acquireLockByUserLayerId: async (
    db: Kysely<DB> | Transaction<DB>,
    userLayerId: string
  ) => {
    await db
      .selectFrom("UserLayer")
      .where("UserLayer.id", "=", userLayerId)
      .forUpdate()
      .noWait()
      .execute();
  }
};
