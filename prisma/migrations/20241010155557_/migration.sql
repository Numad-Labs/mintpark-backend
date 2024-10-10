-- AlterTable
ALTER TABLE "File" ALTER COLUMN "createdAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "generatedPsbtTxId" TEXT,
ALTER COLUMN "createdAt" SET DEFAULT now(),
ALTER COLUMN "updatedAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Purchase" ALTER COLUMN "createdAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "createdAt" SET DEFAULT now();
