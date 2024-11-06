-- AlterTable
ALTER TABLE "Launch" ADD COLUMN     "ownerId" TEXT;

-- AddForeignKey
ALTER TABLE "Launch" ADD CONSTRAINT "Launch_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
