/*
  Warnings:

  - A unique constraint covering the columns `[value,traitTypeId]` on the table `TraitValue` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "TraitValue_value_traitTypeId_key" ON "TraitValue"("value", "traitTypeId");
