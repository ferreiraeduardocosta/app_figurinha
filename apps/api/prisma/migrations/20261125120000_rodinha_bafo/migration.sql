-- CreateEnum
CREATE TYPE "StatusParticipante" AS ENUM ('CONVIDADO', 'DENTRO', 'RECUSOU');

-- CreateTable
CREATE TABLE "RodaBafo" (
    "id" TEXT NOT NULL,
    "anfitriaoId" TEXT NOT NULL,
    "status" "StatusBafo" NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "temporada" INTEGER NOT NULL,
    "estado" JSONB,
    "dia" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RodaBafo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RodaParticipante" (
    "rodaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "status" "StatusParticipante" NOT NULL,
    "lado" TEXT,
    "cartas" JSONB,
    "entrouEm" TIMESTAMP(3),

    CONSTRAINT "RodaParticipante_pkey" PRIMARY KEY ("rodaId","usuarioId")
);

-- CreateIndex
CREATE INDEX "RodaBafo_status_expiraEm_idx" ON "RodaBafo"("status", "expiraEm");

-- CreateIndex
CREATE INDEX "RodaParticipante_usuarioId_status_idx" ON "RodaParticipante"("usuarioId", "status");

-- AddForeignKey
ALTER TABLE "RodaBafo" ADD CONSTRAINT "RodaBafo_anfitriaoId_fkey" FOREIGN KEY ("anfitriaoId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RodaParticipante" ADD CONSTRAINT "RodaParticipante_rodaId_fkey" FOREIGN KEY ("rodaId") REFERENCES "RodaBafo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RodaParticipante" ADD CONSTRAINT "RodaParticipante_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

