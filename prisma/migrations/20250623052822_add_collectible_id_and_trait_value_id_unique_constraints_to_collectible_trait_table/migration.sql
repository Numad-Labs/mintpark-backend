/*
  Warnings:

  - A unique constraint covering the columns `[collectibleId,traitValueId]` on the table `CollectibleTrait` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CollectibleTrait_collectibleId_traitValueId_key" ON "CollectibleTrait"("collectibleId", "traitValueId");
