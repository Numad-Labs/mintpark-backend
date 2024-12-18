/*
  Warnings:

  - Added the required column `name` to the `Collectible` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Collectible" ADD COLUMN     "name" TEXT NOT NULL;
