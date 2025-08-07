-- AlterTable
ALTER TABLE "Collectible" ADD COLUMN     "fileSizeInBytes" INTEGER;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "networkFeeInSats" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TraitValue" ADD COLUMN     "fileSizeInBytes" INTEGER;
