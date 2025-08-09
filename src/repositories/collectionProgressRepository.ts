import { CollectionProgress, DB } from "@app-types/db/types";
import { db } from "@utils/db";
import e from "express";
import { Kysely, sql, Transaction, Updateable } from "kysely";

export const collectionProgressRepository = {
  create: async (db: Kysely<DB> | Transaction<DB>, collectionId: string) => {
    const collectionProgress = await db
      .insertInto("CollectionProgress")
      .values({ collectionId })
      .returningAll()
      .executeTakeFirstOrThrow(
        () => new Error("Could not create collection progress")
      );

    return collectionProgress;
  },
  update: async (
    db: Kysely<DB> | Transaction<DB>,
    collectionId: string,
    data: Updateable<CollectionProgress>
  ) => {
    const collectionProgress = await db
      .updateTable("CollectionProgress")
      .set(data)
      .returningAll()
      .where("CollectionProgress.collectionId", "=", collectionId)
      .executeTakeFirstOrThrow(
        () => new Error("Could not update collection progress")
      );

    return collectionProgress;
  },
  getByCreatorAddress: async (address: string, page: number, limit: number) => {
    const offset = Math.max(page - 1, 0) * limit;

    const collectionProgresses = await db
      .selectFrom("CollectionProgress")
      .innerJoin(
        "Collection",
        "Collection.id",
        "CollectionProgress.collectionId"
      )
      .innerJoin("Layer", "Layer.id", "Collection.layerId")
      .innerJoin("UserLayer", "UserLayer.id", "Collection.creatorUserLayerId")
      .leftJoin("Launch", (join) =>
        join.onRef(
          "CollectionProgress.collectionId",
          "=",
          "Launch.collectionId"
        )
      )
      .select(({ eb, selectFrom }) => [
        "CollectionProgress.collectionId",
        "Launch.id as launchId",
        "Collection.name",
        "Collection.logoKey",
        "Layer.layer",
        "Layer.network",

        selectFrom("Collectible")
          .select([
            sql<number>`COUNT("Collectible"."id")`
              .$castTo<number>()
              .as("confirmedSupply")
          ])
          .where("Collectible.collectionId", "=", eb.ref("Collection.id"))
          .as("supply"),

        eb
          .selectFrom("Order")
          .select([eb.lit(true).as("paymentInitialized")])
          .whereRef("Order.collectionId", "=", "Collection.id")
          .where("Order.isBase", "=", true)
          .limit(1)
          .as("paymentInitialized"),

        "CollectionProgress.paymentCompleted",

        "CollectionProgress.queued",
        "CollectionProgress.ranOutOfFunds",
        "CollectionProgress.retopAmount",

        "CollectionProgress.collectionCompleted",
        "CollectionProgress.leftoverClaimed",
        "CollectionProgress.leftoverAmount",

        "CollectionProgress.launchInReview",
        "CollectionProgress.launchRejected",
        sql<boolean>`CASE WHEN "Launch"."status" = 'CONFIRMED' THEN true ELSE false END`.as(
          "launchConfirmed"
        )
      ])
      .where(sql`LOWER("UserLayer"."address")`, "=", address.toLowerCase())
      .orderBy("Collection.createdAt desc")
      .offset(offset)
      .limit(limit)
      .execute();

    return collectionProgresses.map((collectionProgress) => {
      return {
        ...collectionProgress,
        paymentInitialized:
          String(collectionProgress.paymentInitialized) === "true"
            ? true
            : false
      };
    });
  },
  // getByIdWithDetails: async (collectionId: string) => {
  //   const collectionProgress = await db
  //     .selectFrom("CollectionProgress")
  //     .innerJoin(
  //       "Collection",
  //       "Collection.id",
  //       "CollectionProgress.collectionId"
  //     )
  //     .innerJoin("Layer", "Layer.id", "Collection.layerId")
  //     .innerJoin("UserLayer", "UserLayer.id", "Collection.creatorUserLayerId")
  //     .leftJoin(
  //       "Order",
  //       "CollectionProgress.collectionId",
  //       "Order.collectionId"
  //     )
  //     .leftJoin("Launch", (join) =>
  //       join
  //         .onRef("CollectionProgress.collectionId", "=", "Launch.collectionId")
  //         .on("Launch.status", "=", "CONFIRMED")
  //     )
  //     .select([
  //       "CollectionProgress.collectionId",
  //       "Collection.name",
  //       "Collection.logoKey",
  //       "Layer.layer",
  //       "Layer.network",

  //       (eb) =>
  //         eb
  //           .selectFrom("Order")
  //           .select([eb.lit(true).as("paymentInitialized")])
  //           .whereRef("Order.collectionId", "=", "Collection.id")
  //           .where("Order.isBase", "=", true)
  //           .limit(1)
  //           .as("paymentInitialized"),
  //       "CollectionProgress.paymentCompleted",

  //       "CollectionProgress.queued",
  //       "CollectionProgress.ranOutOfFunds",
  //       "CollectionProgress.retopAmount",

  //       "CollectionProgress.collectionCompleted",
  //       "CollectionProgress.leftoverClaimed",
  //       "CollectionProgress.leftoverAmount",

  //       "CollectionProgress.launchInReview",
  //       "CollectionProgress.launchRejected",
  //       sql<boolean>`CASE WHEN "Launch"."id" IS NOT NULL THEN true ELSE false END`.as(
  //         "launchConfirmed"
  //       )
  //     ])
  //     .where("CollectionProgress.collectionId", "=", collectionId)
  //     .orderBy("Collection.createdAt desc")
  //     .executeTakeFirst();

  //   return collectionProgress;
  // },
  getById: async (collectionId: string) => {
    const collectionProgress = await db
      .selectFrom("CollectionProgress")
      .leftJoin("Launch", (join) =>
        join
          .onRef("CollectionProgress.collectionId", "=", "Launch.collectionId")
          .on("Launch.status", "=", "CONFIRMED")
      )
      .select([
        "CollectionProgress.collectionId",

        (eb) =>
          eb
            .selectFrom("Order")
            .select([eb.lit(true).as("paymentInitialized")])
            .whereRef(
              "Order.collectionId",
              "=",
              "CollectionProgress.collectionId"
            )
            .where("Order.isBase", "=", true)
            .limit(1)
            .as("paymentInitialized"),
        "CollectionProgress.paymentCompleted",

        "CollectionProgress.queued",
        "CollectionProgress.ranOutOfFunds",
        "CollectionProgress.retopAmount",

        "CollectionProgress.collectionCompleted",
        "CollectionProgress.leftoverClaimed",
        "CollectionProgress.leftoverAmount",

        "CollectionProgress.launchInReview",
        "CollectionProgress.launchRejected",

        sql<boolean>`CASE WHEN "Launch"."id" IS NOT NULL THEN true ELSE false END`.as(
          "launchConfirmed"
        )
      ])
      .where("CollectionProgress.collectionId", "=", collectionId)
      .executeTakeFirst();

    return collectionProgress;
  }
};
