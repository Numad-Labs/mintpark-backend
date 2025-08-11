-- DropForeignKey
ALTER TABLE "Collectible" DROP CONSTRAINT "Collectible_collectionId_fkey";

-- DropForeignKey
ALTER TABLE "CollectibleTrait" DROP CONSTRAINT "CollectibleTrait_collectibleId_fkey";

-- DropForeignKey
ALTER TABLE "CollectionProgress" DROP CONSTRAINT "CollectionProgress_collectionId_fkey";

-- DropForeignKey
ALTER TABLE "CollectionUploadSession" DROP CONSTRAINT "CollectionUploadSession_collectionId_fkey";

-- DropForeignKey
ALTER TABLE "Launch" DROP CONSTRAINT "Launch_collectionId_fkey";

-- DropForeignKey
ALTER TABLE "LaunchItem" DROP CONSTRAINT "LaunchItem_collectibleId_fkey";

-- DropForeignKey
ALTER TABLE "LaunchItem" DROP CONSTRAINT "LaunchItem_launchId_fkey";

-- DropForeignKey
ALTER TABLE "List" DROP CONSTRAINT "List_collectibleId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_collectionId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_purchaseId_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_launchItemId_fkey";

-- DropForeignKey
ALTER TABLE "TraitType" DROP CONSTRAINT "TraitType_collectionId_fkey";

-- DropForeignKey
ALTER TABLE "TraitValue" DROP CONSTRAINT "TraitValue_traitTypeId_fkey";

-- DropForeignKey
ALTER TABLE "WlAddress" DROP CONSTRAINT "WlAddress_launchId_fkey";

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionProgress" ADD CONSTRAINT "CollectionProgress_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionUploadSession" ADD CONSTRAINT "CollectionUploadSession_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collectible" ADD CONSTRAINT "Collectible_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraitType" ADD CONSTRAINT "TraitType_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraitValue" ADD CONSTRAINT "TraitValue_traitTypeId_fkey" FOREIGN KEY ("traitTypeId") REFERENCES "TraitType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectibleTrait" ADD CONSTRAINT "CollectibleTrait_collectibleId_fkey" FOREIGN KEY ("collectibleId") REFERENCES "Collectible"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Launch" ADD CONSTRAINT "Launch_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchItem" ADD CONSTRAINT "LaunchItem_collectibleId_fkey" FOREIGN KEY ("collectibleId") REFERENCES "Collectible"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchItem" ADD CONSTRAINT "LaunchItem_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_launchItemId_fkey" FOREIGN KEY ("launchItemId") REFERENCES "LaunchItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WlAddress" ADD CONSTRAINT "WlAddress_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "List" ADD CONSTRAINT "List_collectibleId_fkey" FOREIGN KEY ("collectibleId") REFERENCES "Collectible"("id") ON DELETE CASCADE ON UPDATE CASCADE;
