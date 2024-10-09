-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "isLaunched" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "created_at" SET DEFAULT now(),
ALTER COLUMN "updated_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Purchase" ALTER COLUMN "createdAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "createdAt" SET DEFAULT now();
