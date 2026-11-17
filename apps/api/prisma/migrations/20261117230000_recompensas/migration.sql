-- CreateEnum
CREATE TYPE "TipoRecompensa" AS ENUM ('PAGINA', 'ALBUM');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "pacotesBonus" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Recompensa" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoRecompensa" NOT NULL,
    "chave" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recompensa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Recompensa_usuarioId_tipo_chave_key" ON "Recompensa"("usuarioId", "tipo", "chave");

-- AddForeignKey
ALTER TABLE "Recompensa" ADD CONSTRAINT "Recompensa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

