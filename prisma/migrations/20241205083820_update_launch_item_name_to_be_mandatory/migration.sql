/*
  Warnings:

  - Made the column `name` on table `LaunchItem` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "LaunchItem" ALTER COLUMN "name" SET NOT NULL;
