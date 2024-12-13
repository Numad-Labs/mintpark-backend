/*
  Warnings:

  - Added the required column `nftId` to the `Collectible` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Collectible" ADD COLUMN     "nftId" TEXT NOT NULL;
