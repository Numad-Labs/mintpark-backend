/*
  Warnings:

  - You are about to drop the column `name` on the `OrderItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "LaunchItem" ADD COLUMN     "ipfsUrl" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "name",
ADD COLUMN     "ipfsUrl" TEXT;
