/*
  Warnings:

  - You are about to drop the column `orderId` on the `Purchase` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_orderId_fkey";

-- DropIndex
DROP INDEX "Purchase_orderId_key";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "purchaseId" TEXT;

-- AlterTable
ALTER TABLE "Purchase" DROP COLUMN "orderId";

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
