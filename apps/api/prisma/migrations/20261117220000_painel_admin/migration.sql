-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('JOGADOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "AcaoAdmin" AS ENUM ('CRIAR', 'EDITAR', 'EXCLUIR');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "papel" "Papel" NOT NULL DEFAULT 'JOGADOR';

-- CreateTable
CREATE TABLE "AlteracaoAdmin" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminApelido" TEXT NOT NULL,
    "acao" "AcaoAdmin" NOT NULL,
    "figurinhaCodigo" TEXT NOT NULL,
    "antes" JSONB,
    "depois" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlteracaoAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlteracaoAdmin_criadoEm_idx" ON "AlteracaoAdmin"("criadoEm");

