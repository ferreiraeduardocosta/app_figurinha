import { Prisma, TipoRecompensa } from '@prisma/client';

/** Chave da recompensa de álbum completo desta temporada. */
export const CHAVE_ALBUM = 'T1';
/** Pacotes de recompensa por página do álbum completada. */
export const PACOTES_POR_PAGINA = 1;

export interface RecompensaNova {
  tipo: TipoRecompensa;
  chave: string;
  /** Pacotes de recompensa ganhos com esta recompensa. */
  pacotes: number;
}

/**
 * Confere páginas e álbum completos e entrega o que ainda não foi entregue.
 * Deve rodar dentro da mesma transação que colou as figurinhas, com a linha do
 * jogador travada. A chave única em Recompensa impede entrega dupla mesmo assim.
 */
export async function entregarRecompensas(tx: Prisma.TransactionClient, usuarioId: string): Promise<RecompensaNova[]> {
  const secoes = await tx.$queryRaw<{ secao: string; total: bigint; coladas: bigint }[]>`
    SELECT f."secao" AS secao,
           COUNT(*) AS total,
           COUNT(i."figurinhaCodigo") FILTER (WHERE i."quantidade" > 0) AS coladas
    FROM "Figurinha" f
    LEFT JOIN "ItemAlbum" i ON i."figurinhaCodigo" = f."codigo" AND i."usuarioId" = ${usuarioId}
    GROUP BY f."secao"`;

  const completas = secoes.filter((s) => s.total > 0n && s.coladas === s.total).map((s) => s.secao);
  if (completas.length === 0) return [];

  const jaTem = new Set(
    (await tx.recompensa.findMany({ where: { usuarioId }, select: { tipo: true, chave: true } })).map(
      (r) => `${r.tipo}:${r.chave}`,
    ),
  );

  const novas: RecompensaNova[] = completas
    .filter((secao) => !jaTem.has(`PAGINA:${secao}`))
    .map((secao) => ({ tipo: 'PAGINA', chave: secao, pacotes: PACOTES_POR_PAGINA }));
  if (completas.length === secoes.length && !jaTem.has(`ALBUM:${CHAVE_ALBUM}`)) {
    novas.push({ tipo: 'ALBUM', chave: CHAVE_ALBUM, pacotes: 0 });
  }
  if (novas.length === 0) return [];

  await tx.recompensa.createMany({ data: novas.map((r) => ({ usuarioId, tipo: r.tipo, chave: r.chave })) });
  const pacotes = novas.reduce((s, r) => s + r.pacotes, 0);
  if (pacotes > 0) {
    await tx.usuario.update({ where: { id: usuarioId }, data: { pacotesBonus: { increment: pacotes } } });
  }
  return novas;
}
