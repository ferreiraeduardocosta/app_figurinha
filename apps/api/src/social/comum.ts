import { Prisma } from '@prisma/client';
import { Inventario } from '@liga-aurora/regras';

export type Tx = Prisma.TransactionClient;

/** Trava as linhas dos jogadores sempre em ordem de id, para duas transações nunca se travarem mutuamente. */
export async function travarUsuarios(tx: Tx, ids: string[]) {
  const ordenados = [...new Set(ids)].sort();
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id IN (${Prisma.join(ordenados)}) ORDER BY id FOR UPDATE`;
}

export async function lerInventario(tx: Tx, usuarioId: string): Promise<Inventario> {
  const itens = await tx.itemAlbum.findMany({ where: { usuarioId }, select: { figurinhaCodigo: true, quantidade: true } });
  return Object.fromEntries(itens.map((i) => [i.figurinhaCodigo, i.quantidade]));
}

/** Grava as quantidades novas das figurinhas que mudaram. */
export async function gravarInventario(tx: Tx, usuarioId: string, antes: Inventario, depois: Inventario, codigos: string[]) {
  for (const codigo of codigos) {
    const quantidade = depois[codigo] ?? 0;
    if (quantidade === (antes[codigo] ?? 0)) continue;
    await tx.itemAlbum.upsert({
      where: { usuarioId_figurinhaCodigo: { usuarioId, figurinhaCodigo: codigo } },
      create: { usuarioId, figurinhaCodigo: codigo, quantidade },
      update: { quantidade },
    });
  }
  // Nunca mais brilhantes que cópias.
  await tx.$executeRaw`UPDATE "ItemAlbum" SET "brilhantes" = LEAST("brilhantes", "quantidade") WHERE "usuarioId" = ${usuarioId}`;
}

export const resumoUsuario = { select: { id: true, apelido: true } } as const;
