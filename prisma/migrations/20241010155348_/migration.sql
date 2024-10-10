/*
  Warnings:

  - You are about to drop the column `generatedTxPsbt` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `txid` on the `Order` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "File" DROP COLUMN "generatedTxPsbt",
ADD COLUMN     "generatedPsbtTxId" TEXT,
ALTER COLUMN "createdAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "txid",
ALTER COLUMN "createdAt" SET DEFAULT now(),
ALTER COLUMN "updatedAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Purchase" ALTER COLUMN "createdAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "createdAt" SET DEFAULT now();
