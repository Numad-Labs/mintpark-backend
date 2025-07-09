-- AlterTable
ALTER TABLE "Collectible" ADD COLUMN     "onHoldUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TraitValue" ADD COLUMN     "onHoldUntil" TIMESTAMP(3);
