/*
  Warnings:

  - You are about to drop the column `zIndex` on the `CollectibleTrait` table. All the data in the column will be lost.
  - Added the required column `zIndex` to the `TraitType` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CollectibleTrait" DROP COLUMN "zIndex";

-- AlterTable
ALTER TABLE "TraitType" ADD COLUMN     "zIndex" INTEGER NOT NULL;
