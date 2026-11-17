-- CreateEnum
CREATE TYPE "StatusAmizade" AS ENUM ('PENDENTE', 'ACEITA');

-- CreateEnum
CREATE TYPE "StatusTroca" AS ENUM ('PENDENTE', 'ACEITA', 'RECUSADA', 'CANCELADA', 'EXPIRADA', 'FALHOU');

-- CreateTable
CREATE TABLE "Amizade" (
    "id" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "status" "StatusAmizade" NOT NULL DEFAULT 'PENDENTE',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aceitaEm" TIMESTAMP(3),

    CONSTRAINT "Amizade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Troca" (
    "id" TEXT NOT NULL,
    "propostaPorId" TEXT NOT NULL,
    "paraId" TEXT NOT NULL,
    "oferta" JSONB NOT NULL,
    "pedido" JSONB NOT NULL,
    "status" "StatusTroca" NOT NULL DEFAULT 'PENDENTE',
    "respostaAId" TEXT,
    "motivo" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "respondidaEm" TIMESTAMP(3),

    CONSTRAINT "Troca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Amizade_destinatarioId_status_idx" ON "Amizade"("destinatarioId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Amizade_solicitanteId_destinatarioId_key" ON "Amizade"("solicitanteId", "destinatarioId");

-- CreateIndex
CREATE INDEX "Troca_paraId_status_idx" ON "Troca"("paraId", "status");

-- CreateIndex
CREATE INDEX "Troca_propostaPorId_status_idx" ON "Troca"("propostaPorId", "status");

-- AddForeignKey
ALTER TABLE "Amizade" ADD CONSTRAINT "Amizade_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Amizade" ADD CONSTRAINT "Amizade_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Troca" ADD CONSTRAINT "Troca_propostaPorId_fkey" FOREIGN KEY ("propostaPorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Troca" ADD CONSTRAINT "Troca_paraId_fkey" FOREIGN KEY ("paraId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

