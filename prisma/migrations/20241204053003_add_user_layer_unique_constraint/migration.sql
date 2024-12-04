/*
  Warnings:

  - A unique constraint covering the columns `[address,layerId]` on the table `UserLayer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserLayer_address_layerId_key" ON "UserLayer"("address", "layerId");
