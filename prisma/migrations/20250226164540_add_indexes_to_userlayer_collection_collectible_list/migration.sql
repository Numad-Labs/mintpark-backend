-- CreateIndex
CREATE INDEX "Collectible_uniqueIdx_idx" ON "Collectible"("uniqueIdx");

-- CreateIndex
CREATE INDEX "Collectible_status_uniqueIdx_idx" ON "Collectible"("status", "uniqueIdx");

-- CreateIndex
CREATE INDEX "Collectible_collectionId_uniqueIdx_idx" ON "Collectible"("collectionId", "uniqueIdx");

-- CreateIndex
CREATE INDEX "Collectible_createdAt_idx" ON "Collectible"("createdAt");

-- CreateIndex
CREATE INDEX "Collectible_nftId_idx" ON "Collectible"("nftId");

-- CreateIndex
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

-- CreateIndex
CREATE INDEX "List_status_idx" ON "List"("status");

-- CreateIndex
CREATE INDEX "List_collectibleId_status_idx" ON "List"("collectibleId", "status");

-- CreateIndex
CREATE INDEX "List_status_sellerId_idx" ON "List"("status", "sellerId");

-- CreateIndex
CREATE INDEX "List_listedAt_idx" ON "List"("listedAt");

-- CreateIndex
CREATE INDEX "List_price_idx" ON "List"("price");

-- CreateIndex
CREATE INDEX "UserLayer_address_isActive_idx" ON "UserLayer"("address", "isActive");
