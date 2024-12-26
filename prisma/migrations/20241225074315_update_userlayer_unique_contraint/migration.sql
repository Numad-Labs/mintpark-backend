/*
  Warnings:

  - A unique constraint covering the columns `[address,isActive,layerId,deactivatedAt]` on the table `UserLayer` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "UserLayer_address_layerId_deactivatedAt_key";

-- CreateIndex
CREATE UNIQUE INDEX "UserLayer_address_isActive_layerId_deactivatedAt_key" ON "UserLayer"("address", "isActive", "layerId", "deactivatedAt");
