-- AlterTable
ALTER TABLE "Collectible" ADD COLUMN     "authTag" TEXT,
ADD COLUMN     "iv" TEXT;

-- AlterTable
ALTER TABLE "TraitValue" ADD COLUMN     "authTag" TEXT,
ADD COLUMN     "iv" TEXT;
