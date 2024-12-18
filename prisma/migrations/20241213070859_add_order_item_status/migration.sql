/*
  Warnings:

  - Added the required column `type` to the `OrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ORDER_ITEM_TYPE" AS ENUM ('MINT_COLLECTIBLE', 'MINT_RECURSIVE_COLLECTIBLE', 'LAUNCH_BUY');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "type" "ORDER_ITEM_TYPE" NOT NULL;
