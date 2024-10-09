-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "collectibleId" TEXT DEFAULT '-',
ADD COLUMN     "collectionId" TEXT DEFAULT '-',
ALTER COLUMN "createdAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Purchase" ALTER COLUMN "createdAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "createdAt" SET DEFAULT now();
