/*
  Warnings:

  - You are about to drop the column `poEndsAtBigInt` on the `Launch` table. All the data in the column will be lost.
  - You are about to drop the column `poStartsAtBigInt` on the `Launch` table. All the data in the column will be lost.
  - You are about to drop the column `wlEndsAtBigInt` on the `Launch` table. All the data in the column will be lost.
  - You are about to drop the column `wlStartsAtBigInt` on the `Launch` table. All the data in the column will be lost.
  - The `poEndsAt` column on the `Launch` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `poStartsAt` column on the `Launch` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `wlEndsAt` column on the `Launch` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `wlStartsAt` column on the `Launch` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Launch" DROP COLUMN "poEndsAtBigInt",
DROP COLUMN "poStartsAtBigInt",
DROP COLUMN "wlEndsAtBigInt",
DROP COLUMN "wlStartsAtBigInt",
DROP COLUMN "poEndsAt",
ADD COLUMN     "poEndsAt" BIGINT NOT NULL DEFAULT 0,
DROP COLUMN "poStartsAt",
ADD COLUMN     "poStartsAt" BIGINT NOT NULL DEFAULT 0,
DROP COLUMN "wlEndsAt",
ADD COLUMN     "wlEndsAt" BIGINT,
DROP COLUMN "wlStartsAt",
ADD COLUMN     "wlStartsAt" BIGINT;
