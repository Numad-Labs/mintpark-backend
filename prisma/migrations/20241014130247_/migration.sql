-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_layer_id_fkey";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "layer_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_layer_id_fkey" FOREIGN KEY ("layer_id") REFERENCES "Layer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
