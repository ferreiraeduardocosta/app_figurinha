-- CreateEnum
CREATE TYPE "TipoEventoBafo" AS ENUM ('DOBRADO', 'TORNEIO', 'TEMATICO');

-- CreateTable
CREATE TABLE "EventoBafo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoEventoBafo" NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "multiplicadorLimite" INTEGER NOT NULL DEFAULT 1,
    "bonusChance" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "filtroClube" TEXT,
    "filtroRaridade" "Raridade",
    "premioPacotes" INTEGER NOT NULL DEFAULT 0,
    "premiados" INTEGER NOT NULL DEFAULT 0,
    "premiosEntreguesEm" TIMESTAMP(3),
    "criadoPor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoBafo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventoBafo_inicio_fim_idx" ON "EventoBafo"("inicio", "fim");

