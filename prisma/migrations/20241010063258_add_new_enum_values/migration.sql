-- CreateEnum
CREATE TYPE "FILE_STATUS" AS ENUM ('MINTED', 'PENDING');

-- AlterTable
ALTER TABLE "File" ADD COLUMN     "generatedTxPsbt" TEXT,
ADD COLUMN     "status" "FILE_STATUS" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "createdAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "created_at" SET DEFAULT now(),
ALTER COLUMN "updated_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Purchase" ALTER COLUMN "createdAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "createdAt" SET DEFAULT now();
