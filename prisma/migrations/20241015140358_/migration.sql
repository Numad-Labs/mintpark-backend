/*
  Warnings:

  - You are about to drop the column `collection_id` on the `Collectible` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `Collectible` table. All the data in the column will be lost.
  - You are about to drop the column `unique_idx` on the `Collectible` table. All the data in the column will be lost.
  - You are about to drop the column `collectible_id` on the `CollectibleTrait` table. All the data in the column will be lost.
  - You are about to drop the column `trait_id` on the `CollectibleTrait` table. All the data in the column will be lost.
  - You are about to drop the column `logo_key` on the `Collection` table. All the data in the column will be lost.
  - You are about to drop the column `collection_id` on the `Launch` table. All the data in the column will be lost.
  - You are about to drop the column `is_whitelisted` on the `Launch` table. All the data in the column will be lost.
  - You are about to drop the column `po_ends_at` on the `Launch` table. All the data in the column will be lost.
  - You are about to drop the column `po_max_mint_per_wallet` on the `Launch` table. All the data in the column will be lost.
  - You are about to drop the column `po_mint_price` on the `Launch` table. All the data in the column will be lost.
  - You are about to drop the column `po_starts_at` on the `Launch` table. All the data in the column will be lost.
  - You are about to drop the column `wl_ends_at` on the `Launch` table. All the data in the column will be lost.
  - You are about to drop the column `wl_max_mint_per_wallet` on the `Launch` table. All the data in the column will be lost.
  - You are about to drop the column `wl_mint_price` on the `Launch` table. All the data in the column will be lost.
  - You are about to drop the column `wl_starts_at` on the `Launch` table. All the data in the column will be lost.
  - You are about to drop the column `file_key` on the `LaunchItem` table. All the data in the column will be lost.
  - You are about to drop the column `launch_id` on the `LaunchItem` table. All the data in the column will be lost.
  - You are about to drop the column `buyer_id` on the `List` table. All the data in the column will be lost.
  - You are about to drop the column `collectible_id` on the `List` table. All the data in the column will be lost.
  - You are about to drop the column `listed_at` on the `List` table. All the data in the column will be lost.
  - You are about to drop the column `private_key` on the `List` table. All the data in the column will be lost.
  - You are about to drop the column `seller_id` on the `List` table. All the data in the column will be lost.
  - You are about to drop the column `sold_at` on the `List` table. All the data in the column will be lost.
  - You are about to drop the column `collection_id` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `funding_address` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `funding_amount` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `minted_at` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `network_fee` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `order_status` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `order_type` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `paid_at` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `private_key` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `service_fee` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `tx_id` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `file_key` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `order_id` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `launch_item_id` on the `Purchase` table. All the data in the column will be lost.
  - You are about to drop the column `order_id` on the `Purchase` table. All the data in the column will be lost.
  - You are about to drop the column `purchased_at` on the `Purchase` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `Purchase` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `layer_id` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `launch_id` on the `WlAddress` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[collectibleId]` on the table `List` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[orderId]` on the table `Purchase` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `collectionId` to the `Collectible` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uniqueIdx` to the `Collectible` table without a default value. This is not possible if the table is not empty.
  - Added the required column `collectibleId` to the `CollectibleTrait` table without a default value. This is not possible if the table is not empty.
  - Added the required column `traitId` to the `CollectibleTrait` table without a default value. This is not possible if the table is not empty.
  - Added the required column `logoKey` to the `Collection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `collectionId` to the `Launch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isWhitelisted` to the `Launch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `poEndsAt` to the `Launch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `poMaxMintPerWallet` to the `Launch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `poMintPrice` to the `Launch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `poStartsAt` to the `Launch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileKey` to the `LaunchItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `launchId` to the `LaunchItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `collectibleId` to the `List` table without a default value. This is not possible if the table is not empty.
  - Added the required column `privateKey` to the `List` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sellerId` to the `List` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fundingAddress` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fundingAmount` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `networkFee` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orderType` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `privateKey` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serviceFee` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileKey` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orderId` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `launchItemId` to the `Purchase` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orderId` to the `Purchase` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Purchase` table without a default value. This is not possible if the table is not empty.
  - Added the required column `launchId` to the `WlAddress` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Collectible" DROP CONSTRAINT "Collectible_collection_id_fkey";

-- DropForeignKey
ALTER TABLE "CollectibleTrait" DROP CONSTRAINT "CollectibleTrait_collectible_id_fkey";

-- DropForeignKey
ALTER TABLE "CollectibleTrait" DROP CONSTRAINT "CollectibleTrait_trait_id_fkey";

-- DropForeignKey
ALTER TABLE "Launch" DROP CONSTRAINT "Launch_collection_id_fkey";

-- DropForeignKey
ALTER TABLE "LaunchItem" DROP CONSTRAINT "LaunchItem_launch_id_fkey";

-- DropForeignKey
ALTER TABLE "List" DROP CONSTRAINT "List_collectible_id_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_collection_id_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_user_id_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_order_id_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_launch_item_id_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_order_id_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_user_id_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_layer_id_fkey";

-- DropForeignKey
ALTER TABLE "WlAddress" DROP CONSTRAINT "WlAddress_launch_id_fkey";

-- DropIndex
DROP INDEX "List_collectible_id_key";

-- DropIndex
DROP INDEX "Purchase_order_id_key";

-- AlterTable
ALTER TABLE "Collectible" DROP COLUMN "collection_id",
DROP COLUMN "created_at",
DROP COLUMN "unique_idx",
ADD COLUMN     "collectionId" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "uniqueIdx" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "CollectibleTrait" DROP COLUMN "collectible_id",
DROP COLUMN "trait_id",
ADD COLUMN     "collectibleId" TEXT NOT NULL,
ADD COLUMN     "traitId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Collection" DROP COLUMN "logo_key",
ADD COLUMN     "logoKey" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Launch" DROP COLUMN "collection_id",
DROP COLUMN "is_whitelisted",
DROP COLUMN "po_ends_at",
DROP COLUMN "po_max_mint_per_wallet",
DROP COLUMN "po_mint_price",
DROP COLUMN "po_starts_at",
DROP COLUMN "wl_ends_at",
DROP COLUMN "wl_max_mint_per_wallet",
DROP COLUMN "wl_mint_price",
DROP COLUMN "wl_starts_at",
ADD COLUMN     "collectionId" TEXT NOT NULL,
ADD COLUMN     "isWhitelisted" BOOLEAN NOT NULL,
ADD COLUMN     "poEndsAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "poMaxMintPerWallet" INTEGER NOT NULL,
ADD COLUMN     "poMintPrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "poStartsAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "wlEndsAt" TIMESTAMP(3),
ADD COLUMN     "wlMaxMintPerWallet" INTEGER,
ADD COLUMN     "wlMintPrice" DOUBLE PRECISION,
ADD COLUMN     "wlStartsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LaunchItem" DROP COLUMN "file_key",
DROP COLUMN "launch_id",
ADD COLUMN     "fileKey" TEXT NOT NULL,
ADD COLUMN     "launchId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "List" DROP COLUMN "buyer_id",
DROP COLUMN "collectible_id",
DROP COLUMN "listed_at",
DROP COLUMN "private_key",
DROP COLUMN "seller_id",
DROP COLUMN "sold_at",
ADD COLUMN     "buyerId" TEXT,
ADD COLUMN     "collectibleId" TEXT NOT NULL,
ADD COLUMN     "listedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "privateKey" TEXT NOT NULL,
ADD COLUMN     "sellerId" TEXT NOT NULL,
ADD COLUMN     "soldAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "collection_id",
DROP COLUMN "created_at",
DROP COLUMN "funding_address",
DROP COLUMN "funding_amount",
DROP COLUMN "minted_at",
DROP COLUMN "network_fee",
DROP COLUMN "order_status",
DROP COLUMN "order_type",
DROP COLUMN "paid_at",
DROP COLUMN "private_key",
DROP COLUMN "service_fee",
DROP COLUMN "tx_id",
DROP COLUMN "user_id",
ADD COLUMN     "collectionId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fundingAddress" TEXT NOT NULL,
ADD COLUMN     "fundingAmount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "mintedAt" TIMESTAMP(3),
ADD COLUMN     "networkFee" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "orderStatus" "ORDER_STATUS" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "orderType" "ORDER_TYPE" NOT NULL,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "privateKey" TEXT NOT NULL,
ADD COLUMN     "serviceFee" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "txId" TEXT,
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "file_key",
DROP COLUMN "order_id",
ADD COLUMN     "fileKey" TEXT NOT NULL,
ADD COLUMN     "orderId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Purchase" DROP COLUMN "launch_item_id",
DROP COLUMN "order_id",
DROP COLUMN "purchased_at",
DROP COLUMN "user_id",
ADD COLUMN     "launchItemId" TEXT NOT NULL,
ADD COLUMN     "orderId" TEXT NOT NULL,
ADD COLUMN     "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "created_at",
DROP COLUMN "layer_id",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "layerId" TEXT;

-- AlterTable
ALTER TABLE "WlAddress" DROP COLUMN "launch_id",
ADD COLUMN     "launchId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "List_collectibleId_key" ON "List"("collectibleId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_orderId_key" ON "Purchase"("orderId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "Layer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_launchItemId_fkey" FOREIGN KEY ("launchItemId") REFERENCES "LaunchItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchItem" ADD CONSTRAINT "LaunchItem_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Launch" ADD CONSTRAINT "Launch_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WlAddress" ADD CONSTRAINT "WlAddress_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectibleTrait" ADD CONSTRAINT "CollectibleTrait_collectibleId_fkey" FOREIGN KEY ("collectibleId") REFERENCES "Collectible"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectibleTrait" ADD CONSTRAINT "CollectibleTrait_traitId_fkey" FOREIGN KEY ("traitId") REFERENCES "Trait"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collectible" ADD CONSTRAINT "Collectible_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "List" ADD CONSTRAINT "List_collectibleId_fkey" FOREIGN KEY ("collectibleId") REFERENCES "Collectible"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
