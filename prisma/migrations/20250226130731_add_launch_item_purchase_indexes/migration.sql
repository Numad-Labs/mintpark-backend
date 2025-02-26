-- CreateIndex
CREATE INDEX "LaunchItem_launchId_idx" ON "LaunchItem"("launchId");

-- CreateIndex
CREATE INDEX "LaunchItem_status_idx" ON "LaunchItem"("status");

-- CreateIndex
CREATE INDEX "LaunchItem_onHoldBy_idx" ON "LaunchItem"("onHoldBy");

-- CreateIndex
CREATE INDEX "LaunchItem_onHoldUntil_idx" ON "LaunchItem"("onHoldUntil");

-- CreateIndex
CREATE INDEX "LaunchItem_launchId_status_idx" ON "LaunchItem"("launchId", "status");

-- CreateIndex
CREATE INDEX "LaunchItem_launchId_status_onHoldUntil_idx" ON "LaunchItem"("launchId", "status", "onHoldUntil");

-- CreateIndex
CREATE INDEX "LaunchItem_status_onHoldBy_idx" ON "LaunchItem"("status", "onHoldBy");

-- CreateIndex
CREATE INDEX "Purchase_userId_idx" ON "Purchase"("userId");

-- CreateIndex
CREATE INDEX "Purchase_purchasedAddress_idx" ON "Purchase"("purchasedAddress");

-- CreateIndex
CREATE INDEX "Purchase_purchasedAt_idx" ON "Purchase"("purchasedAt");

-- CreateIndex
CREATE INDEX "Purchase_launchItemId_idx" ON "Purchase"("launchItemId");
