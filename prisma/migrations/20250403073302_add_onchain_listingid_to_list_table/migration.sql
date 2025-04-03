-- AlterTable
ALTER TABLE "List" ADD COLUMN     "onchainListingId" TEXT,
ALTER COLUMN "privateKey" DROP NOT NULL;
