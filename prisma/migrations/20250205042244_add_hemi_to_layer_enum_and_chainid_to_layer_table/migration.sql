-- AlterEnum
ALTER TYPE "LAYER" ADD VALUE 'HEMI';

-- AlterTable
ALTER TABLE "Layer" ADD COLUMN     "chainId" TEXT;
