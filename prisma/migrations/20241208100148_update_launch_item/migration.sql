/*
  Warnings:

  - You are about to drop the column `evmAssetId` on the `LaunchItem` table. All the data in the column will be lost.
  - Added the required column `userLayerId` to the `Launch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `collectibleId` to the `LaunchItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Launch" ADD COLUMN     "userLayerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "LaunchItem" DROP COLUMN "evmAssetId",
ADD COLUMN     "collectibleId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Launch" ADD CONSTRAINT "Launch_userLayerId_fkey" FOREIGN KEY ("userLayerId") REFERENCES "UserLayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchItem" ADD CONSTRAINT "LaunchItem_collectibleId_fkey" FOREIGN KEY ("collectibleId") REFERENCES "Collectible"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
