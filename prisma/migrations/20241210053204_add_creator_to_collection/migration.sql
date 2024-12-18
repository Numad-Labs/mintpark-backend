/*
  Warnings:

  - You are about to drop the column `creator` on the `Collection` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `Launch` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Launch" DROP CONSTRAINT "Launch_ownerId_fkey";

-- AlterTable
ALTER TABLE "Collection" DROP COLUMN "creator",
ADD COLUMN     "creatorId" TEXT,
ADD COLUMN     "creatorName" TEXT,
ADD COLUMN     "creatorUserLayerId" TEXT;

-- AlterTable
ALTER TABLE "Launch" DROP COLUMN "ownerId",
ADD COLUMN     "userId" TEXT;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_creatorUserLayerId_fkey" FOREIGN KEY ("creatorUserLayerId") REFERENCES "UserLayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Launch" ADD CONSTRAINT "Launch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
