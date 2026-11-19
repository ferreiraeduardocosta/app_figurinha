-- CreateEnum
CREATE TYPE "StatusBafo" AS ENUM ('CONVITE', 'JOGANDO', 'FINALIZADA', 'RECUSADA', 'CANCELADA', 'EXPIRADA');

-- CreateTable
CREATE TABLE "Bafo" (
    "id" TEXT NOT NULL,
    "desafianteId" TEXT NOT NULL,
    "adversarioId" TEXT,
    "contraComputador" BOOLEAN NOT NULL DEFAULT false,
    "status" "StatusBafo" NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "cartasA" JSONB NOT NULL,
    "estado" JSONB,
    "dia" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bafo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bafo_desafianteId_status_idx" ON "Bafo"("desafianteId", "status");

-- CreateIndex
CREATE INDEX "Bafo_adversarioId_status_idx" ON "Bafo"("adversarioId", "status");

-- CreateIndex
CREATE INDEX "Bafo_status_expiraEm_idx" ON "Bafo"("status", "expiraEm");

-- AddForeignKey
ALTER TABLE "Bafo" ADD CONSTRAINT "Bafo_desafianteId_fkey" FOREIGN KEY ("desafianteId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bafo" ADD CONSTRAINT "Bafo_adversarioId_fkey" FOREIGN KEY ("adversarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

