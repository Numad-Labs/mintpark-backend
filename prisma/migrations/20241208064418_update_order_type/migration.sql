/*
  Warnings:

  - The values [MINT] on the enum `ORDER_TYPE` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ORDER_TYPE_new" AS ENUM ('MINT_COLLECTIBLE', 'MINT_TRAIT', 'LAUNCH_BUY');
ALTER TABLE "Order" ALTER COLUMN "orderType" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "orderType" TYPE "ORDER_TYPE_new" USING ("orderType"::text::"ORDER_TYPE_new");
ALTER TYPE "ORDER_TYPE" RENAME TO "ORDER_TYPE_old";
ALTER TYPE "ORDER_TYPE_new" RENAME TO "ORDER_TYPE";
DROP TYPE "ORDER_TYPE_old";
ALTER TABLE "Order" ALTER COLUMN "orderType" SET DEFAULT 'MINT_COLLECTIBLE';
COMMIT;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "orderType" SET DEFAULT 'MINT_COLLECTIBLE';
