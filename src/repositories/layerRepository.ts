import { Insertable, Updateable } from "kysely";
import { db } from "../utils/db";
import { Layer } from "../types/db/types";

export const layerRepository = {
  create: async (data: Insertable<Layer>) => {
    const layer = await db
      .insertInto("Layer")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow(() => new Error("Couldnt create the layer."));

    return layer;
  },
  update: async (id: string, data: Updateable<Layer>) => {
    const layer = await db
      .updateTable("Layer")
      .returningAll()
      .set(data)
      .where("Layer.id", "=", id)
      .executeTakeFirstOrThrow(() => new Error("Couldnt update the layer."));

    return layer;
  },
  delete: async (id: string) => {
    const layer = await db
      .deleteFrom("Layer")
      .returningAll()
      .where("Layer.id", "=", id)
      .executeTakeFirstOrThrow(() => new Error("Couldnt delete the layer."));

    return layer;
  },
  getById: async (id: string) => {
    const layer = await db
      .selectFrom("Layer")
      .selectAll()
      .where("Layer.id", "=", id)
      .executeTakeFirst();

    return layer;
  },
  getByName: async (name: string) => {
    const layers = await db
      .selectFrom("Layer")
      .selectAll()
      .where("Layer.name", "=", name)
      .execute();

    return layers;
  },
  getAll: async () => {
    const layers = await db.selectFrom("Layer").selectAll().execute();

    return layers;
  },
};