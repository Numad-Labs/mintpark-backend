-- CreateIndex
CREATE INDEX "Collectible_collectionId_status_idx" ON "Collectible"("collectionId", "status");

-- CreateIndex
CREATE INDEX "CollectibleTrait_collectibleId_traitValueId_idx" ON "CollectibleTrait"("collectibleId", "traitValueId");
