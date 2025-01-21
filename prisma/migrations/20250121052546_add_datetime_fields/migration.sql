/*
  Warnings:

  - You are about to drop the column `expiredAt` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `paidAt` on the `Order` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Launch" ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "expiredAt",
DROP COLUMN "paidAt";

-- AlterTable
ALTER TABLE "TraitValue" ALTER COLUMN "mintedAt" DROP NOT NULL,
ALTER COLUMN "mintedAt" DROP DEFAULT;
