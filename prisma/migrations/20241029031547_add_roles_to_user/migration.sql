-- CreateEnum
CREATE TYPE "ROLES" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "ROLES" NOT NULL DEFAULT 'USER';