/*
  Warnings:

  - You are about to drop the column `collectible_id` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `collection_key` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `total_amount` on the `Order` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "COLLECTION_STATUS" AS ENUM ('LIVE', 'UPCOMING', 'PAST');

-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "status" "COLLECTION_STATUS" NOT NULL DEFAULT 'UPCOMING';

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "collectible_id",
DROP COLUMN "collection_key",
DROP COLUMN "total_amount",
ADD COLUMN     "collectible_key" TEXT,
ADD COLUMN     "collection_id" TEXT,
ALTER COLUMN "created_at" SET DEFAULT now(),
ALTER COLUMN "updated_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Purchase" ALTER COLUMN "createdAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "createdAt" SET DEFAULT now();
