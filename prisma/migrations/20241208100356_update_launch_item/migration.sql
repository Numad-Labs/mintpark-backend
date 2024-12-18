/*
  Warnings:

  - You are about to drop the column `fileKey` on the `LaunchItem` table. All the data in the column will be lost.
  - You are about to drop the column `ipfsUrl` on the `LaunchItem` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `LaunchItem` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `LaunchItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "LaunchItem" DROP COLUMN "fileKey",
DROP COLUMN "ipfsUrl",
DROP COLUMN "metadata",
DROP COLUMN "name";
