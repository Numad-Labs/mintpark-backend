-- CreateIndex
CREATE INDEX "Collection_layerId_status_idx" ON "Collection"("layerId", "status");

-- CreateIndex
CREATE INDEX "List_collectibleId_status_listedAt_idx" ON "List"("collectibleId", "status", "listedAt");

-- CreateIndex
CREATE INDEX "List_price_status_idx" ON "List"("price", "status");

-- CreateIndex
CREATE INDEX "List_collectibleId_status_price_idx" ON "List"("collectibleId", "status", "price");

-- CreateIndex
CREATE INDEX "Purchase_purchasedAddress_purchasedAt_idx" ON "Purchase"("purchasedAddress", "purchasedAt");
