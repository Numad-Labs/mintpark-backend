-- AlterTable
ALTER TABLE "Collectible" ADD COLUMN     "generatedPsbtTxId" TEXT,
ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "Purchase" ALTER COLUMN "createdAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "createdAt" SET DEFAULT now();

-- AddForeignKey
ALTER TABLE "Collectible" ADD CONSTRAINT "Collectible_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
