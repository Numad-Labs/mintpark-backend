-- AlterTable
ALTER TABLE "LaunchItem" ADD COLUMN     "onHoldBy" TEXT;

-- AddForeignKey
ALTER TABLE "LaunchItem" ADD CONSTRAINT "LaunchItem_onHoldBy_fkey" FOREIGN KEY ("onHoldBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
