-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_collectibleId_fkey";

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "traitValueId" TEXT,
ALTER COLUMN "collectibleId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_collectibleId_fkey" FOREIGN KEY ("collectibleId") REFERENCES "Collectible"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_traitValueId_fkey" FOREIGN KEY ("traitValueId") REFERENCES "TraitValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
