/*
  Warnings:

  - A unique constraint covering the columns `[address,layerId,deactivatedAt]` on the table `UserLayer` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "UserLayer_address_layerId_key";

-- AlterTable
ALTER TABLE "UserLayer" ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "UserLayer_address_layerId_deactivatedAt_key" ON "UserLayer"("address", "layerId", "deactivatedAt");
