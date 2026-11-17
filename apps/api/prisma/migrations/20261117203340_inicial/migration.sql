-- CreateEnum
CREATE TYPE "Raridade" AS ENUM ('COMUM', 'RARA', 'EPICA', 'LENDARIA');

-- CreateEnum
CREATE TYPE "TipoFigurinha" AS ENUM ('ESCUDO', 'ESTADIO', 'TECNICO', 'JOGADOR', 'MASCOTE', 'LENDA', 'MOMENTO');

-- CreateEnum
CREATE TYPE "OrigemPacote" AS ENUM ('DIARIO', 'MOEDAS', 'COMPRA', 'RECOMPENSA');

-- CreateTable
CREATE TABLE "Clube" (
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "corPrimaria" TEXT NOT NULL,
    "corSecundaria" TEXT NOT NULL,
    "estadio" TEXT NOT NULL,
    "capacidade" INTEGER NOT NULL,
    "mascote" TEXT NOT NULL,
    "lema" TEXT NOT NULL,
    "identidade" TEXT NOT NULL,

    CONSTRAINT "Clube_pkey" PRIMARY KEY ("sigla")
);

-- CreateTable
CREATE TABLE "Figurinha" (
    "codigo" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "temporada" INTEGER NOT NULL DEFAULT 1,
    "secao" TEXT NOT NULL,
    "clubeSigla" TEXT NOT NULL,
    "tipo" "TipoFigurinha" NOT NULL,
    "raridade" "Raridade" NOT NULL,
    "nome" TEXT NOT NULL,
    "apelido" TEXT,
    "posicao" TEXT,
    "camisa" INTEGER,
    "idade" INTEGER,
    "destaque" TEXT,
    "historia" TEXT NOT NULL,
    "descricaoVisual" TEXT NOT NULL,
    "ataque" INTEGER,
    "defesa" INTEGER,
    "tecnica" INTEGER,
    "velocidade" INTEGER,
    "fisico" INTEGER,

    CONSTRAINT "Figurinha_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "apelido" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moedas" INTEGER NOT NULL DEFAULT 0,
    "pacotesSemEpica" INTEGER NOT NULL DEFAULT 0,
    "pacotesSemLendaria" INTEGER NOT NULL DEFAULT 0,
    "ultimoPacoteDiarioEm" TIMESTAMP(3),

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemAlbum" (
    "usuarioId" TEXT NOT NULL,
    "figurinhaCodigo" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "brilhantes" INTEGER NOT NULL DEFAULT 0,
    "primeiraEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemAlbum_pkey" PRIMARY KEY ("usuarioId","figurinhaCodigo")
);

-- CreateTable
CREATE TABLE "AberturaPacote" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "origem" "OrigemPacote" NOT NULL,
    "resultado" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AberturaPacote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Clube_nome_key" ON "Clube"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Figurinha_numero_key" ON "Figurinha"("numero");

-- CreateIndex
CREATE INDEX "Figurinha_raridade_idx" ON "Figurinha"("raridade");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_apelido_key" ON "Usuario"("apelido");

-- CreateIndex
CREATE INDEX "AberturaPacote_usuarioId_criadoEm_idx" ON "AberturaPacote"("usuarioId", "criadoEm");

-- AddForeignKey
ALTER TABLE "Figurinha" ADD CONSTRAINT "Figurinha_clubeSigla_fkey" FOREIGN KEY ("clubeSigla") REFERENCES "Clube"("sigla") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAlbum" ADD CONSTRAINT "ItemAlbum_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAlbum" ADD CONSTRAINT "ItemAlbum_figurinhaCodigo_fkey" FOREIGN KEY ("figurinhaCodigo") REFERENCES "Figurinha"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AberturaPacote" ADD CONSTRAINT "AberturaPacote_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
