/*
  Warnings:

  - You are about to drop the column `collection_id` on the `Order` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Order" DROP COLUMN "collection_id",
ADD COLUMN     "collection_key" TEXT,
ADD COLUMN     "minting_type" "MINTING_TYPE" NOT NULL DEFAULT 'COLLECTIBLE',
ALTER COLUMN "collectible_id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DEFAULT now(),
ALTER COLUMN "updated_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Purchase" ALTER COLUMN "createdAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "createdAt" SET DEFAULT now();
