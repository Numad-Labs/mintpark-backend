-- CreateEnum
CREATE TYPE "LAUNCH_STATUS" AS ENUM ('UNCONFIRMED', 'CONFIRMED');

-- AlterTable
ALTER TABLE "Launch" ADD COLUMN     "status" "COLLECTIBLE_STATUS" NOT NULL DEFAULT 'UNCONFIRMED';
