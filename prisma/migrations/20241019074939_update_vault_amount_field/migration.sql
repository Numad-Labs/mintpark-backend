/*
  Warnings:

  - You are about to drop the column `vaultAmount` on the `List` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "List" DROP COLUMN "vaultAmount",
ADD COLUMN     "inscribedAmount" INTEGER DEFAULT 546;
