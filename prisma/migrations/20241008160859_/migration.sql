/*
  Warnings:

  - You are about to drop the column `supply` on the `Collection` table. All the data in the column will be lost.
  - You are about to drop the column `ticker` on the `Collection` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Collection` table. All the data in the column will be lost.
  - Added the required column `ownerAddress` to the `Collection` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Collection" DROP CONSTRAINT "Collection_userId_fkey";

-- AlterTable
ALTER TABLE "Collection" DROP COLUMN "supply",
DROP COLUMN "ticker",
DROP COLUMN "userId",
ADD COLUMN     "creator" TEXT,
ADD COLUMN     "feeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ownerAddress" TEXT NOT NULL,
ALTER COLUMN "walletLimit" SET DEFAULT 1000;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "created_at" SET DEFAULT now(),
ALTER COLUMN "updated_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Purchase" ALTER COLUMN "createdAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "createdAt" SET DEFAULT now();

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_ownerAddress_fkey" FOREIGN KEY ("ownerAddress") REFERENCES "User"("address") ON DELETE CASCADE ON UPDATE CASCADE;
