/*
  Warnings:

  - The values [UNCONFIRMED,LAUNCHED,MINTED] on the enum `COLLECTION_TYPE` will be removed. If these variants are still used in the database, this will fail.
  - The values [TOKEN,COLLECTIBLE,COLLECTION,LAUNCH] on the enum `ORDER_TYPE` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `name` on the `Collectible` table. All the data in the column will be lost.
  - You are about to drop the column `txid` on the `Collectible` table. All the data in the column will be lost.
  - You are about to drop the column `rarity` on the `CollectibleTrait` table. All the data in the column will be lost.
  - You are about to drop the column `traitId` on the `CollectibleTrait` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `CollectibleTrait` table. All the data in the column will be lost.
  - You are about to drop the column `networkFee` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `serviceFee` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `txId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `evmAssetId` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `fileKey` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `ipfsUrl` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `txid` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the `Trait` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `traitValueId` to the `CollectibleTrait` table without a default value. This is not possible if the table is not empty.
  - Added the required column `zIndex` to the `CollectibleTrait` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userLayerId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `collectibleId` to the `OrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "COLLECTION_STATUS" AS ENUM ('UNCONFIRMED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "COLLECTIBLE_STATUS" AS ENUM ('UNCONFIRMED', 'CONFIRMED', 'BURNED', 'LOCKED');

-- AlterEnum
BEGIN;
CREATE TYPE "COLLECTION_TYPE_new" AS ENUM ('INSCRIPTION', 'RECURSIVE_INSCRIPTION', 'IPFS', 'SYNTHETIC');
ALTER TABLE "Collection" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Collection" ALTER COLUMN "type" TYPE "COLLECTION_TYPE_new" USING ("type"::text::"COLLECTION_TYPE_new");
ALTER TYPE "COLLECTION_TYPE" RENAME TO "COLLECTION_TYPE_old";
ALTER TYPE "COLLECTION_TYPE_new" RENAME TO "COLLECTION_TYPE";
DROP TYPE "COLLECTION_TYPE_old";
ALTER TABLE "Collection" ALTER COLUMN "type" SET DEFAULT 'RECURSIVE_INSCRIPTION';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ORDER_TYPE_new" AS ENUM ('MINT', 'LAUNCH_BUY');
ALTER TABLE "Order" ALTER COLUMN "orderType" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "orderType" TYPE "ORDER_TYPE_new" USING ("orderType"::text::"ORDER_TYPE_new");
ALTER TYPE "ORDER_TYPE" RENAME TO "ORDER_TYPE_old";
ALTER TYPE "ORDER_TYPE_new" RENAME TO "ORDER_TYPE";
DROP TYPE "ORDER_TYPE_old";
ALTER TABLE "Order" ALTER COLUMN "orderType" SET DEFAULT 'MINT';
COMMIT;

-- DropForeignKey
ALTER TABLE "CollectibleTrait" DROP CONSTRAINT "CollectibleTrait_traitId_fkey";

-- AlterTable
ALTER TABLE "Collectible" DROP COLUMN "name",
DROP COLUMN "txid",
ADD COLUMN     "cid" TEXT,
ADD COLUMN     "lockingAddress" TEXT,
ADD COLUMN     "lockingPrivateKey" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "parentCollectibleId" TEXT,
ADD COLUMN     "status" "COLLECTIBLE_STATUS" NOT NULL DEFAULT 'UNCONFIRMED';

-- AlterTable
ALTER TABLE "CollectibleTrait" DROP COLUMN "rarity",
DROP COLUMN "traitId",
DROP COLUMN "value",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "traitValueId" TEXT NOT NULL,
ADD COLUMN     "zIndex" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "parentCollectionId" TEXT,
ADD COLUMN     "status" "COLLECTION_STATUS" NOT NULL DEFAULT 'UNCONFIRMED',
ALTER COLUMN "type" SET DEFAULT 'RECURSIVE_INSCRIPTION';

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "networkFee",
DROP COLUMN "quantity",
DROP COLUMN "serviceFee",
DROP COLUMN "txId",
ADD COLUMN     "fundingTxId" TEXT,
ADD COLUMN     "launchItemId" TEXT,
ADD COLUMN     "userLayerId" TEXT NOT NULL,
ALTER COLUMN "orderType" SET DEFAULT 'MINT';

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "evmAssetId",
DROP COLUMN "fileKey",
DROP COLUMN "ipfsUrl",
DROP COLUMN "metadata",
DROP COLUMN "name",
DROP COLUMN "txid",
ADD COLUMN     "collectibleId" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "mintedTxId" TEXT;

-- DropTable
DROP TABLE "Trait";

-- DropEnum
DROP TYPE "COLLECTIBLE_TYPE";

-- CreateTable
CREATE TABLE "TraitType" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectionId" TEXT NOT NULL,

    CONSTRAINT "TraitType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraitValue" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "value" TEXT NOT NULL,
    "inscriptionId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mintedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "traitTypeId" TEXT NOT NULL,

    CONSTRAINT "TraitValue_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userLayerId_fkey" FOREIGN KEY ("userLayerId") REFERENCES "UserLayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_launchItemId_fkey" FOREIGN KEY ("launchItemId") REFERENCES "LaunchItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_collectibleId_fkey" FOREIGN KEY ("collectibleId") REFERENCES "Collectible"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_parentCollectionId_fkey" FOREIGN KEY ("parentCollectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collectible" ADD CONSTRAINT "Collectible_parentCollectibleId_fkey" FOREIGN KEY ("parentCollectibleId") REFERENCES "Collectible"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraitType" ADD CONSTRAINT "TraitType_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraitValue" ADD CONSTRAINT "TraitValue_traitTypeId_fkey" FOREIGN KEY ("traitTypeId") REFERENCES "TraitType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectibleTrait" ADD CONSTRAINT "CollectibleTrait_traitValueId_fkey" FOREIGN KEY ("traitValueId") REFERENCES "TraitValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
