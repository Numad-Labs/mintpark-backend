-- CreateTable
CREATE TABLE "Airdrop" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "address" TEXT NOT NULL,

    CONSTRAINT "Airdrop_pkey" PRIMARY KEY ("id")
);
