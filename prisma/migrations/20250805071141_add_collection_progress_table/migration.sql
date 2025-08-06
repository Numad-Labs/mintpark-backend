-- CreateTable
CREATE TABLE "CollectionProgress" (
    "collectionId" TEXT NOT NULL,
    "paymentCompleted" BOOLEAN NOT NULL DEFAULT false,
    "queued" BOOLEAN NOT NULL DEFAULT false,
    "ranOutOfFunds" BOOLEAN NOT NULL DEFAULT false,
    "retopAmount" DOUBLE PRECISION DEFAULT 0,
    "collectionCompleted" BOOLEAN NOT NULL DEFAULT false,
    "leftoverClaimed" BOOLEAN NOT NULL DEFAULT false,
    "leftoverAmount" DOUBLE PRECISION DEFAULT 0,
    "launchInReview" BOOLEAN NOT NULL DEFAULT false,
    "launchRejected" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CollectionProgress_pkey" PRIMARY KEY ("collectionId")
);

-- AddForeignKey
ALTER TABLE "CollectionProgress" ADD CONSTRAINT "CollectionProgress_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
