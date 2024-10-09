/*
  Warnings:

  - The values [CONFIRMED,FAILED] on the enum `ORDER_STATUS` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `collectibleId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `collectionId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `userAddress` on the `Order` table. All the data in the column will be lost.
  - Added the required column `user_address` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LAYER_TYPE" AS ENUM ('FRACTAL', 'BITCOIN', 'ETHEREUM', 'COORDINATE', 'FRACTAL_TESTNET', 'BITCOIN_TESTNET', 'ETHEREUM_TESTNET', 'COORDINATE_TESTNET');

-- AlterEnum
BEGIN;
CREATE TYPE "ORDER_STATUS_new" AS ENUM ('PENDING', 'IN_QUEUE', 'INSCRIBING', 'INSCRIBED', 'CLOSED');
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "ORDER_STATUS_new" USING ("status"::text::"ORDER_STATUS_new");
ALTER TYPE "ORDER_STATUS" RENAME TO "ORDER_STATUS_old";
ALTER TYPE "ORDER_STATUS_new" RENAME TO "ORDER_STATUS";
DROP TYPE "ORDER_STATUS_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_userAddress_fkey";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "collectibleId",
DROP COLUMN "collectionId",
DROP COLUMN "createdAt",
DROP COLUMN "userAddress",
ADD COLUMN     "collectible_id" TEXT DEFAULT '-',
ADD COLUMN     "collection_id" TEXT DEFAULT '-',
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
ADD COLUMN     "network_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "service_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "txid" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
ADD COLUMN     "user_address" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Purchase" ALTER COLUMN "createdAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "createdAt" SET DEFAULT now();

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_user_address_fkey" FOREIGN KEY ("user_address") REFERENCES "User"("address") ON DELETE CASCADE ON UPDATE CASCADE;
