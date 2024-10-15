/*
  Warnings:

  - You are about to drop the column `collectionId` on the `Collectible` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Collectible` table. All the data in the column will be lost.
  - You are about to drop the column `fileKey` on the `Collectible` table. All the data in the column will be lost.
  - You are about to drop the column `generatedPsbtTxId` on the `Collectible` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Collectible` table. All the data in the column will be lost.
  - You are about to drop the column `onHoldUntil` on the `Collectible` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `Collectible` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Collectible` table. All the data in the column will be lost.
  - You are about to drop the column `transactionId` on the `Collectible` table. All the data in the column will be lost.
  - You are about to drop the column `POStartDate` on the `Collection` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Collection` table. All the data in the column will be lost.
  - You are about to drop the column `logoKey` on the `Collection` table. All the data in the column will be lost.
  - You are about to drop the column `mintedCount` on the `Collection` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Collection` table. All the data in the column will be lost.
  - You are about to drop the column `ticker` on the `Collection` table. All the data in the column will be lost.
  - You are about to drop the column `totalCount` on the `Collection` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Collection` table. All the data in the column will be lost.
  - You are about to drop the column `walletLimit` on the `Collection` table. All the data in the column will be lost.
  - You are about to drop the column `buyerId` on the `Purchase` table. All the data in the column will be lost.
  - You are about to drop the column `collectibleId` on the `Purchase` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Purchase` table. All the data in the column will be lost.
  - You are about to drop the column `transactionId` on the `Purchase` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `nickname` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `profileLink` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Transaction` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[order_id]` on the table `Purchase` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[pubkey]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `collection_id` to the `Collectible` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unique_idx` to the `Collectible` table without a default value. This is not possible if the table is not empty.
  - Added the required column `creator` to the `Collection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `logo_key` to the `Collection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `launch_item_id` to the `Purchase` table without a default value. This is not possible if the table is not empty.
  - Added the required column `order_id` to the `Purchase` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `Purchase` table without a default value. This is not possible if the table is not empty.
  - Added the required column `layer_id` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ORDER_TYPE" AS ENUM ('TOKEN', 'COLLECTIBLE', 'COLLECTION', 'LAUNCH');

-- CreateEnum
CREATE TYPE "ORDER_STATUS" AS ENUM ('PENDING', 'IN_QUEUE', 'DONE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ORDER_ITEM_STATUS" AS ENUM ('PENDING', 'IN_QUEUE', 'MINTING', 'MINTED', 'FAILED');

-- CreateEnum
CREATE TYPE "COLLECTION_TYPE" AS ENUM ('UNCONFIRMED', 'LAUNCHED', 'MINTED');

-- CreateEnum
CREATE TYPE "LIST_STATUS" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LAUNCH_ITEM_STATUS" AS ENUM ('ACTIVE', 'ON_HOLD', 'SOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LAYER" AS ENUM ('BITCOIN', 'FRACTAL', 'CITREA');

-- CreateEnum
CREATE TYPE "NETWORK" AS ENUM ('MAINNET', 'TESTNET');

-- DropForeignKey
ALTER TABLE "Collectible" DROP CONSTRAINT "Collectible_collectionId_fkey";

-- DropForeignKey
ALTER TABLE "Collectible" DROP CONSTRAINT "Collectible_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Collectible" DROP CONSTRAINT "Collectible_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "Collection" DROP CONSTRAINT "Collection_userId_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_buyerId_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_collectibleId_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_transactionId_fkey";

-- DropIndex
DROP INDEX "Collectible_id_key";

-- DropIndex
DROP INDEX "Collection_id_key";

-- DropIndex
DROP INDEX "Purchase_id_key";

-- DropIndex
DROP INDEX "User_id_key";

-- AlterTable
ALTER TABLE "Collectible" DROP COLUMN "collectionId",
DROP COLUMN "createdAt",
DROP COLUMN "fileKey",
DROP COLUMN "generatedPsbtTxId",
DROP COLUMN "name",
DROP COLUMN "onHoldUntil",
DROP COLUMN "ownerId",
DROP COLUMN "status",
DROP COLUMN "transactionId",
ADD COLUMN     "collection_id" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "unique_idx" INTEGER NOT NULL,
ADD CONSTRAINT "Collectible_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Collection" DROP COLUMN "POStartDate",
DROP COLUMN "createdAt",
DROP COLUMN "logoKey",
DROP COLUMN "mintedCount",
DROP COLUMN "price",
DROP COLUMN "ticker",
DROP COLUMN "totalCount",
DROP COLUMN "userId",
DROP COLUMN "walletLimit",
ADD COLUMN     "creator" TEXT NOT NULL,
ADD COLUMN     "logo_key" TEXT NOT NULL,
ADD CONSTRAINT "Collection_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Purchase" DROP COLUMN "buyerId",
DROP COLUMN "collectibleId",
DROP COLUMN "createdAt",
DROP COLUMN "transactionId",
ADD COLUMN     "launch_item_id" TEXT NOT NULL,
ADD COLUMN     "order_id" TEXT NOT NULL,
ADD COLUMN     "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "user_id" TEXT NOT NULL,
ADD CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "User" DROP COLUMN "createdAt",
DROP COLUMN "nickname",
DROP COLUMN "profileLink",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "layer_id" TEXT NOT NULL,
ADD COLUMN     "pubkey" TEXT,
ALTER COLUMN "xpub" DROP NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "Transaction";

-- DropEnum
DROP TYPE "COLLECTIBLE_STATUS";

-- DropEnum
DROP TYPE "TRANSACTION_STATUS";

-- CreateTable
CREATE TABLE "Layer" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "layer" "LAYER" NOT NULL DEFAULT 'FRACTAL',
    "network" "NETWORK" NOT NULL DEFAULT 'TESTNET',

    CONSTRAINT "Layer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "collection_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "funding_address" TEXT NOT NULL,
    "network_fee" DOUBLE PRECISION NOT NULL,
    "service_fee" DOUBLE PRECISION NOT NULL,
    "funding_amount" DOUBLE PRECISION NOT NULL,
    "tx_id" TEXT,
    "private_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "minted_at" TIMESTAMP(3),
    "order_type" "ORDER_TYPE" NOT NULL,
    "order_status" "ORDER_STATUS" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "order_id" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "metadata" JSONB,
    "status" "ORDER_ITEM_STATUS" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchItem" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "launch_id" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "status" "LAUNCH_ITEM_STATUS" NOT NULL,

    CONSTRAINT "LaunchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Launch" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "collection_id" TEXT NOT NULL,
    "is_whitelisted" BOOLEAN NOT NULL,
    "wl_starts_at" TIMESTAMP(3),
    "wl_ends_at" TIMESTAMP(3),
    "wl_mint_price" DOUBLE PRECISION,
    "wl_max_mint_per_wallet" INTEGER,
    "po_starts_at" TIMESTAMP(3) NOT NULL,
    "po_ends_at" TIMESTAMP(3) NOT NULL,
    "po_mint_price" DOUBLE PRECISION NOT NULL,
    "po_max_mint_per_wallet" INTEGER NOT NULL,

    CONSTRAINT "Launch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WlAddress" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "launch_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,

    CONSTRAINT "WlAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trait" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,

    CONSTRAINT "Trait_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectibleTrait" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "collectible_id" TEXT NOT NULL,
    "trait_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "rarity" DOUBLE PRECISION NOT NULL,
    "xpub" TEXT,

    CONSTRAINT "CollectibleTrait_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "List" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "collectible_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "buyer_id" TEXT,
    "address" TEXT NOT NULL,
    "private_key" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "listed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sold_at" TIMESTAMP(3),
    "status" "LIST_STATUS" NOT NULL,

    CONSTRAINT "List_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "List_collectible_id_key" ON "List"("collectible_id");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_order_id_key" ON "Purchase"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_pubkey_key" ON "User"("pubkey");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_layer_id_fkey" FOREIGN KEY ("layer_id") REFERENCES "Layer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_launch_item_id_fkey" FOREIGN KEY ("launch_item_id") REFERENCES "LaunchItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchItem" ADD CONSTRAINT "LaunchItem_launch_id_fkey" FOREIGN KEY ("launch_id") REFERENCES "Launch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Launch" ADD CONSTRAINT "Launch_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WlAddress" ADD CONSTRAINT "WlAddress_launch_id_fkey" FOREIGN KEY ("launch_id") REFERENCES "Launch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectibleTrait" ADD CONSTRAINT "CollectibleTrait_collectible_id_fkey" FOREIGN KEY ("collectible_id") REFERENCES "Collectible"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectibleTrait" ADD CONSTRAINT "CollectibleTrait_trait_id_fkey" FOREIGN KEY ("trait_id") REFERENCES "Trait"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collectible" ADD CONSTRAINT "Collectible_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "List" ADD CONSTRAINT "List_collectible_id_fkey" FOREIGN KEY ("collectible_id") REFERENCES "Collectible"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
