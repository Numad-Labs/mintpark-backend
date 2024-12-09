/*
  Warnings:

  - The `status` column on the `Launch` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Launch" DROP COLUMN "status",
ADD COLUMN     "status" "LAUNCH_STATUS" NOT NULL DEFAULT 'UNCONFIRMED';
