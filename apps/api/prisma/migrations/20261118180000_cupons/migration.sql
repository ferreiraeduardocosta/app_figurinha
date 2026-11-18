-- CreateTable
CREATE TABLE "Cupom" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "pacotes" INTEGER NOT NULL,
    "descricao" TEXT,
    "maxUsos" INTEGER,
    "validoAte" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPorId" TEXT NOT NULL,
    "criadoPorApelido" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cupom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CupomDestinatario" (
    "cupomId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "CupomDestinatario_pkey" PRIMARY KEY ("cupomId","usuarioId")
);

-- CreateTable
CREATE TABLE "CupomResgate" (
    "cupomId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CupomResgate_pkey" PRIMARY KEY ("cupomId","usuarioId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cupom_codigo_key" ON "Cupom"("codigo");

-- CreateIndex
CREATE INDEX "Cupom_criadoEm_idx" ON "Cupom"("criadoEm");

-- CreateIndex
CREATE INDEX "CupomDestinatario_usuarioId_idx" ON "CupomDestinatario"("usuarioId");

-- CreateIndex
CREATE INDEX "CupomResgate_usuarioId_idx" ON "CupomResgate"("usuarioId");

-- AddForeignKey
ALTER TABLE "CupomDestinatario" ADD CONSTRAINT "CupomDestinatario_cupomId_fkey" FOREIGN KEY ("cupomId") REFERENCES "Cupom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CupomDestinatario" ADD CONSTRAINT "CupomDestinatario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CupomResgate" ADD CONSTRAINT "CupomResgate_cupomId_fkey" FOREIGN KEY ("cupomId") REFERENCES "Cupom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CupomResgate" ADD CONSTRAINT "CupomResgate_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

