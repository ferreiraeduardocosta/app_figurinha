-- CreateTable
CREATE TABLE "ConfiguracaoLiga" (
    "temporada" INTEGER NOT NULL,
    "primeiraRodada" TIMESTAMP(3) NOT NULL,
    "intervaloMinutos" INTEGER NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoLiga_pkey" PRIMARY KEY ("temporada")
);

