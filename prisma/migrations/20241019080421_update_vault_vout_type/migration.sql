/*
  Warnings:

  - The `vaultVout` column on the `List` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "List" DROP COLUMN "vaultVout",
ADD COLUMN     "vaultVout" INTEGER;
