-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "feeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "createdAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Purchase" ALTER COLUMN "createdAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "createdAt" SET DEFAULT now();
