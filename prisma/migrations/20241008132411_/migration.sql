-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "layer_type" "LAYER_TYPE" NOT NULL DEFAULT 'BITCOIN_TESTNET';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "layer_type" "LAYER_TYPE" NOT NULL DEFAULT 'BITCOIN_TESTNET',
ALTER COLUMN "created_at" SET DEFAULT now(),
ALTER COLUMN "updated_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Purchase" ALTER COLUMN "createdAt" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "createdAt" SET DEFAULT now();
