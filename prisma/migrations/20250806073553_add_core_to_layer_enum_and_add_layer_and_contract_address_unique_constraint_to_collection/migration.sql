/*
  Warnings:

  - A unique constraint covering the columns `[contractAddress,layerId]` on the table `Collection` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "LAYER" ADD VALUE 'CORE';

-- CreateIndex
CREATE UNIQUE INDEX "Collection_contractAddress_layerId_key" ON "Collection"("contractAddress", "layerId");
