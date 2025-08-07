-- CreateTable
CREATE TABLE "CollectionUploadSession" (
    "collectionId" TEXT NOT NULL,
    "expectedTraitTypes" INTEGER NOT NULL,
    "expectedTraitValues" INTEGER NOT NULL,
    "expectedRecursive" INTEGER NOT NULL,
    "expectedOOOEditions" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionUploadSession_pkey" PRIMARY KEY ("collectionId")
);

-- AddForeignKey
ALTER TABLE "CollectionUploadSession" ADD CONSTRAINT "CollectionUploadSession_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
