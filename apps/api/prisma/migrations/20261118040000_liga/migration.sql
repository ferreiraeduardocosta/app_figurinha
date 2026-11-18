-- CreateTable
CREATE TABLE "Partida" (
    "id" TEXT NOT NULL,
    "temporada" INTEGER NOT NULL,
    "rodada" INTEGER NOT NULL,
    "mandante" TEXT NOT NULL,
    "visitante" TEXT NOT NULL,
    "dataPrevista" TIMESTAMP(3) NOT NULL,
    "golsMandante" INTEGER,
    "golsVisitante" INTEGER,
    "gols" JSONB,
    "simuladaEm" TIMESTAMP(3),

    CONSTRAINT "Partida_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Partida_temporada_rodada_idx" ON "Partida"("temporada", "rodada");

-- CreateIndex
CREATE UNIQUE INDEX "Partida_temporada_rodada_mandante_key" ON "Partida"("temporada", "rodada", "mandante");

