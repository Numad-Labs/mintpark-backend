-- AlterTable
ALTER TABLE "WlAddress" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "FailedMint" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "launchItemId" TEXT NOT NULL,

    CONSTRAINT "FailedMint_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FailedMint" ADD CONSTRAINT "FailedMint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FailedMint" ADD CONSTRAINT "FailedMint_launchItemId_fkey" FOREIGN KEY ("launchItemId") REFERENCES "LaunchItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
