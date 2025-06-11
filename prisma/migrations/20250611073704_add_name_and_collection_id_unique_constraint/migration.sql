/*
  Warnings:

  - A unique constraint covering the columns `[name,collectionId]` on the table `TraitType` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "TraitType_name_collectionId_key" ON "TraitType"("name", "collectionId");
