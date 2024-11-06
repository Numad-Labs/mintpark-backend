-- CreateEnum
CREATE TYPE "ORDER_TYPE" AS ENUM ('TOKEN', 'COLLECTIBLE', 'COLLECTION', 'LAUNCH');

-- CreateEnum
CREATE TYPE "ORDER_STATUS" AS ENUM ('PENDING', 'IN_QUEUE', 'DONE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ORDER_ITEM_STATUS" AS ENUM ('PENDING', 'IN_QUEUE', 'MINTING', 'MINTED', 'FAILED');

-- CreateEnum
CREATE TYPE "COLLECTION_TYPE" AS ENUM ('UNCONFIRMED', 'LAUNCHED', 'MINTED');

-- CreateEnum
CREATE TYPE "LIST_STATUS" AS ENUM ('PENDING', 'ACTIVE', 'SOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LAUNCH_ITEM_STATUS" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LAYER" AS ENUM ('BITCOIN', 'FRACTAL', 'CITREA');

-- CreateEnum
CREATE TYPE "NETWORK" AS ENUM ('MAINNET', 'TESTNET');

-- CreateEnum
CREATE TYPE "ROLES" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "layerId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "pubkey" TEXT,
    "xpub" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "ROLES" NOT NULL DEFAULT 'USER',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "ticker" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Layer" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "layer" "LAYER" NOT NULL DEFAULT 'FRACTAL',
    "network" "NETWORK" NOT NULL DEFAULT 'TESTNET',
    "currencyId" TEXT NOT NULL,

    CONSTRAINT "Layer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "collectionId" TEXT,
    "quantity" INTEGER NOT NULL,
    "feeRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "fundingAddress" TEXT,
    "networkFee" DOUBLE PRECISION NOT NULL,
    "serviceFee" DOUBLE PRECISION NOT NULL,
    "fundingAmount" DOUBLE PRECISION NOT NULL,
    "txId" TEXT,
    "privateKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "mintedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "orderType" "ORDER_TYPE" NOT NULL DEFAULT 'COLLECTIBLE',
    "orderStatus" "ORDER_STATUS" NOT NULL DEFAULT 'PENDING',
    "purchaseId" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "orderId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "ipfsUrl" TEXT,
    "metadata" JSONB,
    "status" "ORDER_ITEM_STATUS" NOT NULL DEFAULT 'PENDING',
    "txid" TEXT,
    "evmAssetId" TEXT,
    "name" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "creator" TEXT,
    "description" TEXT NOT NULL,
    "logoKey" TEXT,
    "supply" INTEGER NOT NULL,
    "type" "COLLECTION_TYPE" NOT NULL DEFAULT 'UNCONFIRMED',
    "discordUrl" TEXT,
    "twitterUrl" TEXT,
    "websiteUrl" TEXT,
    "iconUrl" TEXT,
    "inscriptionIcon" TEXT,
    "slug" TEXT,
    "layerId" TEXT NOT NULL,
    "contractAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "launchItemId" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchItem" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "launchId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "ipfsUrl" TEXT,
    "metadata" JSONB,
    "status" "LAUNCH_ITEM_STATUS" NOT NULL DEFAULT 'ACTIVE',
    "evmAssetId" TEXT,
    "name" TEXT,
    "onHoldUntil" TIMESTAMP(3),
    "onHoldBy" TEXT,

    CONSTRAINT "LaunchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Launch" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "collectionId" TEXT NOT NULL,
    "isWhitelisted" BOOLEAN NOT NULL,
    "wlStartsAt" BIGINT,
    "wlEndsAt" BIGINT,
    "wlMintPrice" DOUBLE PRECISION,
    "wlMaxMintPerWallet" INTEGER,
    "poStartsAt" BIGINT NOT NULL DEFAULT 0,
    "poEndsAt" BIGINT NOT NULL DEFAULT 0,
    "poMintPrice" DOUBLE PRECISION NOT NULL,
    "poMaxMintPerWallet" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Launch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WlAddress" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "launchId" TEXT NOT NULL,
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
    "collectibleId" TEXT NOT NULL,
    "traitId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "rarity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CollectibleTrait_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collectible" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT,
    "collectionId" TEXT NOT NULL,
    "uniqueIdx" TEXT NOT NULL,
    "fileKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "txid" TEXT,

    CONSTRAINT "Collectible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "List" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "collectibleId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT,
    "address" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "vaultTxid" TEXT,
    "vaultVout" INTEGER,
    "inscribedAmount" INTEGER DEFAULT 546,
    "price" DOUBLE PRECISION NOT NULL,
    "listedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldTxid" TEXT,
    "soldAt" TIMESTAMP(3),
    "status" "LIST_STATUS" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "List_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");

-- CreateIndex
CREATE UNIQUE INDEX "User_pubkey_key" ON "User"("pubkey");

-- CreateIndex
CREATE UNIQUE INDEX "User_xpub_key" ON "User"("xpub");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_ticker_key" ON "Currency"("ticker");

-- CreateIndex
CREATE INDEX "Currency_ticker_idx" ON "Currency"("ticker");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "Layer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Layer" ADD CONSTRAINT "Layer_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "Layer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_launchItemId_fkey" FOREIGN KEY ("launchItemId") REFERENCES "LaunchItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchItem" ADD CONSTRAINT "LaunchItem_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchItem" ADD CONSTRAINT "LaunchItem_onHoldBy_fkey" FOREIGN KEY ("onHoldBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
