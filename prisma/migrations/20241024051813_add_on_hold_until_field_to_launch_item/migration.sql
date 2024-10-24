/*
  Warnings:

  - The values [ON_HOLD] on the enum `LAUNCH_ITEM_STATUS` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "LAUNCH_ITEM_STATUS_new" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED');
ALTER TABLE "LaunchItem" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "LaunchItem" ALTER COLUMN "status" TYPE "LAUNCH_ITEM_STATUS_new" USING ("status"::text::"LAUNCH_ITEM_STATUS_new");
ALTER TYPE "LAUNCH_ITEM_STATUS" RENAME TO "LAUNCH_ITEM_STATUS_old";
ALTER TYPE "LAUNCH_ITEM_STATUS_new" RENAME TO "LAUNCH_ITEM_STATUS";
DROP TYPE "LAUNCH_ITEM_STATUS_old";
ALTER TABLE "LaunchItem" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- AlterTable
ALTER TABLE "LaunchItem" ADD COLUMN     "onHoldUntil" TIMESTAMP(3);
