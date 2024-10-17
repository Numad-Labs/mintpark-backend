-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "layerId" TEXT;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "Layer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
