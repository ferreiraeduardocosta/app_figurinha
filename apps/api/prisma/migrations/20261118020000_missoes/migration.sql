-- CreateTable
CREATE TABLE "MissaoDia" (
    "usuarioId" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "missaoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "meta" INTEGER NOT NULL,
    "recompensa" INTEGER NOT NULL,
    "progresso" INTEGER NOT NULL DEFAULT 0,
    "resgatadaEm" TIMESTAMP(3),

    CONSTRAINT "MissaoDia_pkey" PRIMARY KEY ("usuarioId","dia","missaoId")
);

-- AddForeignKey
ALTER TABLE "MissaoDia" ADD CONSTRAINT "MissaoDia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

