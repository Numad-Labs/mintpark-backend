-- AlterTable
ALTER TABLE "Launch" ADD COLUMN     "poEndsAtBigInt" BIGINT,
ADD COLUMN     "poStartsAtBigInt" BIGINT,
ADD COLUMN     "wlEndsAtBigInt" BIGINT,
ADD COLUMN     "wlStartsAtBigInt" BIGINT,
ALTER COLUMN "poEndsAt" DROP NOT NULL,
ALTER COLUMN "poStartsAt" DROP NOT NULL;
