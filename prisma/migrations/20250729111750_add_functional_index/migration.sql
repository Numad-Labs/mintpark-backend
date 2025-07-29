-- CreateIndex
CREATE INDEX "idx_userlayer_lower_address_layer_active_created" 
ON "UserLayer" (LOWER(address), "layerId", "isActive", "createdAt" DESC);