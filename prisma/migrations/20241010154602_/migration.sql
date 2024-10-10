/*
  Warnings:

  - You are about to drop the column `layer_type` on the `Collection` table. All the data in the column will be lost.
  - You are about to drop the column `collection_id` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `file_key` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `collectible_key` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `collection_id` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `funding_address` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `funding_private_key` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `layer_type` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `minting_type` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `network_fee` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `order_id` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `service_fee` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `user_address` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `txid` on the `Transaction` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[orderId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[txId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `collectionId` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileKey` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fundingAddress` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fundingPrivateKey` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userAddress` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `txId` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_collection_id_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_user_address_fkey";

-- DropIndex
DROP INDEX "Order_order_id_key";

-- DropIndex
DROP INDEX "Transaction_txid_key";

-- AlterTable
ALTER TABLE "Collection" DROP COLUMN "layer_type",
ADD COLUMN     "layerType" "LAYER_TYPE" NOT NULL DEFAULT 'BITCOIN_TESTNET';

-- AlterTable
ALTER TABLE "File" DROP COLUMN "collection_id",
DROP COLUMN "file_key",
ADD COLUMN     "collectionId" TEXT NOT NULL,
ADD COLUMN     "fileKey" TEXT NOT NULL,
ALTER COLUMN "createdAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "collectible_key",
DROP COLUMN "collection_id",
DROP COLUMN "created_at",
DROP COLUMN "funding_address",
DROP COLUMN "funding_private_key",
DROP COLUMN "layer_type",
DROP COLUMN "minting_type",
DROP COLUMN "network_fee",
DROP COLUMN "order_id",
DROP COLUMN "service_fee",
DROP COLUMN "updated_at",
DROP COLUMN "user_address",
ADD COLUMN     "collectibleKey" TEXT,
ADD COLUMN     "collectionId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
ADD COLUMN     "fundingAddress" TEXT NOT NULL,
ADD COLUMN     "fundingPrivateKey" TEXT NOT NULL,
ADD COLUMN     "layerType" "LAYER_TYPE" NOT NULL DEFAULT 'BITCOIN_TESTNET',
ADD COLUMN     "mintingType" "MINTING_TYPE" NOT NULL DEFAULT 'COLLECTIBLE',
ADD COLUMN     "networkFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "orderId" TEXT NOT NULL DEFAULT gen_random_uuid(),
ADD COLUMN     "serviceFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
ADD COLUMN     "userAddress" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Purchase" ALTER COLUMN "createdAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "txid",
ADD COLUMN     "txId" TEXT NOT NULL,
ALTER COLUMN "createdAt" SET DEFAULT now();

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderId_key" ON "Order"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_txId_key" ON "Transaction"("txId");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User"("address") ON DELETE CASCADE ON UPDATE CASCADE;
