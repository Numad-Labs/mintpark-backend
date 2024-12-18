/*
  Warnings:

  - The values [MINT_COLLECTIBLE,MINT_RECURSIVE_COLLECTIBLE,LAUNCH_BUY] on the enum `ORDER_ITEM_TYPE` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ORDER_ITEM_TYPE_new" AS ENUM ('COLLECTIBLE', 'TRAIT');
ALTER TABLE "OrderItem" ALTER COLUMN "type" TYPE "ORDER_ITEM_TYPE_new" USING ("type"::text::"ORDER_ITEM_TYPE_new");
ALTER TYPE "ORDER_ITEM_TYPE" RENAME TO "ORDER_ITEM_TYPE_old";
ALTER TYPE "ORDER_ITEM_TYPE_new" RENAME TO "ORDER_ITEM_TYPE";
DROP TYPE "ORDER_ITEM_TYPE_old";
COMMIT;
