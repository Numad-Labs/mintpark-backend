-- CreateEnum
CREATE TYPE "ACTIVITY_TYPE" AS ENUM ('MINT', 'LIST', 'BUY');

-- CreateTable
CREATE TABLE "ActivityType" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "type" "ACTIVITY_TYPE" NOT NULL,
    "point" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointActivity" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userLayerId" TEXT NOT NULL,
    "activityTypeId" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "awardedPoints" DOUBLE PRECISION NOT NULL,
    "purchaseId" TEXT,
    "listId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityType_type_key" ON "ActivityType"("type");

-- CreateIndex
CREATE INDEX "PointActivity_userLayerId_createdAt_idx" ON "PointActivity"("userLayerId", "createdAt");

-- CreateIndex
CREATE INDEX "PointActivity_activityTypeId_idx" ON "PointActivity"("activityTypeId");

-- CreateIndex
CREATE INDEX "PointActivity_purchaseId_idx" ON "PointActivity"("purchaseId");

-- CreateIndex
CREATE INDEX "PointActivity_listId_idx" ON "PointActivity"("listId");

-- AddForeignKey
ALTER TABLE "PointActivity" ADD CONSTRAINT "PointActivity_userLayerId_fkey" FOREIGN KEY ("userLayerId") REFERENCES "UserLayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointActivity" ADD CONSTRAINT "PointActivity_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointActivity" ADD CONSTRAINT "PointActivity_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointActivity" ADD CONSTRAINT "PointActivity_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE SET NULL ON UPDATE CASCADE;
