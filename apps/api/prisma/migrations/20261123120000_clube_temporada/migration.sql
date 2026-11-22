-- AlterTable
ALTER TABLE "Clube" ADD COLUMN     "temporada" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "Clube_temporada_idx" ON "Clube"("temporada");

