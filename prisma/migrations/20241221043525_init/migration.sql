-- CreateEnum
CREATE TYPE "ORDER_TYPE" AS ENUM ('MINT_COLLECTIBLE', 'MINT_RECURSIVE_COLLECTIBLE', 'LAUNCH_BUY');

-- CreateEnum
CREATE TYPE "ORDER_STATUS" AS ENUM ('PENDING', 'IN_QUEUE', 'DONE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ORDER_ITEM_TYPE" AS ENUM ('COLLECTIBLE', 'TRAIT');

-- CreateEnum
CREATE TYPE "ORDER_ITEM_STATUS" AS ENUM ('PENDING', 'IN_QUEUE', 'MINTING', 'MINTED', 'FAILED');

-- CreateEnum
CREATE TYPE "COLLECTION_STATUS" AS ENUM ('UNCONFIRMED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "COLLECTION_TYPE" AS ENUM ('INSCRIPTION', 'RECURSIVE_INSCRIPTION', 'IPFS', 'SYNTHETIC');

-- CreateEnum
CREATE TYPE "COLLECTIBLE_STATUS" AS ENUM ('UNCONFIRMED', 'CONFIRMED', 'BURNED', 'LOCKED');

-- CreateEnum
CREATE TYPE "LAUNCH_STATUS" AS ENUM ('UNCONFIRMED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "LAUNCH_ITEM_STATUS" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LIST_STATUS" AS ENUM ('PENDING', 'ACTIVE', 'SOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LAYER" AS ENUM ('BITCOIN', 'FRACTAL', 'CITREA');

-- CreateEnum
CREATE TYPE "NETWORK" AS ENUM ('MAINNET', 'TESTNET');

-- CreateEnum
CREATE TYPE "ROLES" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "role" "ROLES" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLayer" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "address" TEXT NOT NULL,
    "pubkey" TEXT,
    "xpub" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "layerId" TEXT NOT NULL,

    CONSTRAINT "UserLayer_pkey" PRIMARY KEY ("id")
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
    "feeRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "fundingAddress" TEXT,
    "fundingAmount" DOUBLE PRECISION NOT NULL,
    "fundingTxId" TEXT,
    "privateKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "mintedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "orderType" "ORDER_TYPE" NOT NULL DEFAULT 'MINT_COLLECTIBLE',
    "orderStatus" "ORDER_STATUS" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT NOT NULL,
    "userLayerId" TEXT NOT NULL,
    "collectionId" TEXT,
    "launchItemId" TEXT,
    "purchaseId" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "mintedTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "ORDER_ITEM_TYPE" NOT NULL,
    "status" "ORDER_ITEM_STATUS" NOT NULL DEFAULT 'PENDING',
    "orderId" TEXT NOT NULL,
    "collectibleId" TEXT,
    "traitValueId" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "creatorName" TEXT,
    "description" TEXT NOT NULL,
    "discordUrl" TEXT,
    "twitterUrl" TEXT,
    "websiteUrl" TEXT,
    "iconUrl" TEXT,
    "inscriptionIcon" TEXT,
    "slug" TEXT,
    "logoKey" TEXT,
    "supply" INTEGER NOT NULL,
    "ownerCount" INTEGER,
    "contractAddress" TEXT,
    "type" "COLLECTION_TYPE" NOT NULL DEFAULT 'RECURSIVE_INSCRIPTION',
    "status" "COLLECTION_STATUS" NOT NULL DEFAULT 'UNCONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "layerId" TEXT NOT NULL,
    "creatorId" TEXT,
    "creatorUserLayerId" TEXT,
    "parentCollectionId" TEXT,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collectible" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "fileKey" TEXT,
    "highResolutionImageUrl" TEXT,
    "cid" TEXT,
    "uniqueIdx" TEXT,
    "nftId" TEXT NOT NULL,
    "metadata" JSONB,
    "status" "COLLECTIBLE_STATUS" NOT NULL DEFAULT 'UNCONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mintingTxId" TEXT,
    "lockingAddress" TEXT,
    "lockingPrivateKey" TEXT,
    "parentCollectibleId" TEXT,
    "collectionId" TEXT NOT NULL,

    CONSTRAINT "Collectible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraitType" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "zIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectionId" TEXT NOT NULL,

    CONSTRAINT "TraitType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraitValue" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "value" TEXT NOT NULL,
    "inscriptionId" TEXT,
    "fileKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mintedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockingAddress" TEXT,
    "lockingPrivateKey" TEXT,
    "traitTypeId" TEXT NOT NULL,

    CONSTRAINT "TraitValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectibleTrait" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectibleId" TEXT NOT NULL,
    "traitValueId" TEXT NOT NULL,

    CONSTRAINT "CollectibleTrait_pkey" PRIMARY KEY ("id")
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
    "poStartsAt" BIGINT NOT NULL,
    "poEndsAt" BIGINT,
    "poMintPrice" DOUBLE PRECISION NOT NULL,
    "poMaxMintPerWallet" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "LAUNCH_STATUS" NOT NULL DEFAULT 'UNCONFIRMED',
    "userLayerId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "Launch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchItem" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "status" "LAUNCH_ITEM_STATUS" NOT NULL DEFAULT 'ACTIVE',
    "onHoldUntil" TIMESTAMP(3),
    "mintingTxId" TEXT,
    "launchId" TEXT NOT NULL,
    "collectibleId" TEXT NOT NULL,
    "onHoldBy" TEXT,

    CONSTRAINT "LaunchItem_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "WlAddress" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "launchId" TEXT NOT NULL,
    "address" TEXT NOT NULL,

    CONSTRAINT "WlAddress_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "UserLayer_address_key" ON "UserLayer"("address");

-- CreateIndex
CREATE UNIQUE INDEX "UserLayer_pubkey_key" ON "UserLayer"("pubkey");

-- CreateIndex
CREATE UNIQUE INDEX "UserLayer_xpub_key" ON "UserLayer"("xpub");

-- CreateIndex
CREATE UNIQUE INDEX "UserLayer_address_layerId_deactivatedAt_key" ON "UserLayer"("address", "layerId", "deactivatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_ticker_key" ON "Currency"("ticker");

-- CreateIndex
CREATE INDEX "Currency_ticker_idx" ON "Currency"("ticker");

-- AddForeignKey
ALTER TABLE "UserLayer" ADD CONSTRAINT "UserLayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLayer" ADD CONSTRAINT "UserLayer_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "Layer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Layer" ADD CONSTRAINT "Layer_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userLayerId_fkey" FOREIGN KEY ("userLayerId") REFERENCES "UserLayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_launchItemId_fkey" FOREIGN KEY ("launchItemId") REFERENCES "LaunchItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_collectibleId_fkey" FOREIGN KEY ("collectibleId") REFERENCES "Collectible"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_traitValueId_fkey" FOREIGN KEY ("traitValueId") REFERENCES "TraitValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "Layer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_creatorUserLayerId_fkey" FOREIGN KEY ("creatorUserLayerId") REFERENCES "UserLayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_parentCollectionId_fkey" FOREIGN KEY ("parentCollectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collectible" ADD CONSTRAINT "Collectible_parentCollectibleId_fkey" FOREIGN KEY ("parentCollectibleId") REFERENCES "Collectible"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collectible" ADD CONSTRAINT "Collectible_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraitType" ADD CONSTRAINT "TraitType_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraitValue" ADD CONSTRAINT "TraitValue_traitTypeId_fkey" FOREIGN KEY ("traitTypeId") REFERENCES "TraitType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectibleTrait" ADD CONSTRAINT "CollectibleTrait_collectibleId_fkey" FOREIGN KEY ("collectibleId") REFERENCES "Collectible"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectibleTrait" ADD CONSTRAINT "CollectibleTrait_traitValueId_fkey" FOREIGN KEY ("traitValueId") REFERENCES "TraitValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Launch" ADD CONSTRAINT "Launch_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Launch" ADD CONSTRAINT "Launch_userLayerId_fkey" FOREIGN KEY ("userLayerId") REFERENCES "UserLayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Launch" ADD CONSTRAINT "Launch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchItem" ADD CONSTRAINT "LaunchItem_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchItem" ADD CONSTRAINT "LaunchItem_collectibleId_fkey" FOREIGN KEY ("collectibleId") REFERENCES "Collectible"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchItem" ADD CONSTRAINT "LaunchItem_onHoldBy_fkey" FOREIGN KEY ("onHoldBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_launchItemId_fkey" FOREIGN KEY ("launchItemId") REFERENCES "LaunchItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WlAddress" ADD CONSTRAINT "WlAddress_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "List" ADD CONSTRAINT "List_collectibleId_fkey" FOREIGN KEY ("collectibleId") REFERENCES "Collectible"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
