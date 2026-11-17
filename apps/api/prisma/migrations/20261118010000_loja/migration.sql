-- CreateEnum
CREATE TYPE "LojaCompra" AS ENUM ('APP_STORE', 'PLAY_STORE', 'TESTE');

-- CreateEnum
CREATE TYPE "StatusCompra" AS ENUM ('CREDITADA', 'ESTORNADA');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "dataNascimento" DATE,
ADD COLUMN     "pacotesComprados" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Compra" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "loja" "LojaCompra" NOT NULL,
    "ambiente" TEXT NOT NULL,
    "transacaoId" TEXT NOT NULL,
    "pacotes" INTEGER NOT NULL,
    "moedas" INTEGER NOT NULL,
    "valorCentavos" INTEGER,
    "moeda" TEXT,
    "status" "StatusCompra" NOT NULL DEFAULT 'CREDITADA',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estornadaEm" TIMESTAMP(3),

    CONSTRAINT "Compra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Compra_transacaoId_key" ON "Compra"("transacaoId");

-- CreateIndex
CREATE INDEX "Compra_usuarioId_criadaEm_idx" ON "Compra"("usuarioId", "criadaEm");

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

