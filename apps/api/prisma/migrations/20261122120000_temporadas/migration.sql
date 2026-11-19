-- Várias temporadas. Tudo o que existe vira a Temporada 1, sem mudar nada para os jogadores.

-- Temporadas
CREATE TABLE "Temporada" (
    "numero" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "requisito" INTEGER,
    "publicada" BOOLEAN NOT NULL DEFAULT true,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Temporada_pkey" PRIMARY KEY ("numero")
);
INSERT INTO "Temporada" ("numero", "nome") VALUES (1, 'Temporada 1');

-- Número da figurinha passa a ser único dentro da temporada.
DROP INDEX "Figurinha_numero_key";
CREATE UNIQUE INDEX "Figurinha_temporada_numero_key" ON "Figurinha"("temporada", "numero");
ALTER TABLE "Figurinha" ADD CONSTRAINT "Figurinha_temporada_fkey" FOREIGN KEY ("temporada") REFERENCES "Temporada"("numero") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Aberturas guardam a temporada do pacote.
ALTER TABLE "AberturaPacote" ADD COLUMN "temporada" INTEGER NOT NULL DEFAULT 1;

-- Pacote grátis: um por dia em cada temporada. Copia o controle atual para a Temporada 1.
CREATE TABLE "PacoteDiario" (
    "usuarioId" TEXT NOT NULL,
    "temporada" INTEGER NOT NULL,
    "abertoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PacoteDiario_pkey" PRIMARY KEY ("usuarioId","temporada")
);
ALTER TABLE "PacoteDiario" ADD CONSTRAINT "PacoteDiario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "PacoteDiario" ("usuarioId", "temporada", "abertoEm")
  SELECT "id", 1, "ultimoPacoteDiarioEm" FROM "Usuario" WHERE "ultimoPacoteDiarioEm" IS NOT NULL;
ALTER TABLE "Usuario" DROP COLUMN "ultimoPacoteDiarioEm";
