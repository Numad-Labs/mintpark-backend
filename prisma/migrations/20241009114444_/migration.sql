/*
  Warnings:

  - You are about to drop the column `ownerId` on the `Collectible` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Collectible" DROP CONSTRAINT "Collectible_ownerId_fkey";

-- AlterTable
ALTER TABLE "Collectible" DROP COLUMN "ownerId",
ADD COLUMN     "ownerAddress" TEXT;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "created_at" SET DEFAULT now(),
ALTER COLUMN "updated_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Purchase" ALTER COLUMN "createdAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "createdAt" SET DEFAULT now();

-- AddForeignKey
ALTER TABLE "Collectible" ADD CONSTRAINT "Collectible_ownerAddress_fkey" FOREIGN KEY ("ownerAddress") REFERENCES "User"("address") ON DELETE CASCADE ON UPDATE CASCADE;
