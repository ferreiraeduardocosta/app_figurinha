import { Prisma, TipoRecompensa } from '@prisma/client';

/** Chave da recompensa de álbum completo de uma temporada ("T1", "T2"...). */
export const chaveAlbum = (temporada: number) => `T${temporada}`;
/** Chave da recompensa de álbum completo da Temporada 1. */
export const CHAVE_ALBUM = chaveAlbum(1);
/**
 * Chave da recompensa de página completa. Na Temporada 1 é só o nome da seção
 * (como sempre foi); nas outras leva a temporada na frente ("T2:Tubarões do Cais"),
 * porque os clubes se repetem entre temporadas.
 */
export const chavePagina = (temporada: number, secao: string) => (temporada === 1 ? secao : `T${temporada}:${secao}`);
/** Pacotes de recompensa por página do álbum completada. */
export const PACOTES_POR_PAGINA = 1;

export interface RecompensaNova {
  tipo: TipoRecompensa;
  chave: string;
  temporada: number;
  /** Pacotes de recompensa ganhos com esta recompensa. */
  pacotes: number;
}

/**
 * Confere páginas e álbum completos e entrega o que ainda não foi entregue.
 * Deve rodar dentro da mesma transação que colou as figurinhas, com a linha do
 * jogador travada. A chave única em Recompensa impede entrega dupla mesmo assim.
 */
export async function entregarRecompensas(tx: Prisma.TransactionClient, usuarioId: string): Promise<RecompensaNova[]> {
  const secoes = await tx.$queryRaw<{ temporada: number; secao: string; total: bigint; coladas: bigint }[]>`
    SELECT f."temporada" AS temporada,
           f."secao" AS secao,
           COUNT(*) AS total,
           COUNT(i."figurinhaCodigo") FILTER (WHERE i."quantidade" > 0) AS coladas
    FROM "Figurinha" f
    LEFT JOIN "ItemAlbum" i ON i."figurinhaCodigo" = f."codigo" AND i."usuarioId" = ${usuarioId}
    GROUP BY f."temporada", f."secao"`;

  const completas = secoes.filter((s) => s.total > 0n && s.coladas === s.total);
  if (completas.length === 0) return [];

  const jaTem = new Set(
    (await tx.recompensa.findMany({ where: { usuarioId }, select: { tipo: true, chave: true } })).map(
      (r) => `${r.tipo}:${r.chave}`,
    ),
  );

  const novas: RecompensaNova[] = [];
  for (const s of completas) {
    const chave = chavePagina(s.temporada, s.secao);
    if (!jaTem.has(`PAGINA:${chave}`)) novas.push({ tipo: 'PAGINA', chave, temporada: s.temporada, pacotes: PACOTES_POR_PAGINA });
  }
  for (const temporada of new Set(secoes.map((s) => s.temporada))) {
    const daTemporada = secoes.filter((s) => s.temporada === temporada);
    const cheia = daTemporada.every((s) => s.total > 0n && s.coladas === s.total);
    if (cheia && !jaTem.has(`ALBUM:${chaveAlbum(temporada)}`)) {
      novas.push({ tipo: 'ALBUM', chave: chaveAlbum(temporada), temporada, pacotes: 0 });
    }
  }
  if (novas.length === 0) return [];

  await tx.recompensa.createMany({ data: novas.map((r) => ({ usuarioId, tipo: r.tipo, chave: r.chave })) });
  const pacotes = novas.reduce((s, r) => s + r.pacotes, 0);
  if (pacotes > 0) {
    await tx.usuario.update({ where: { id: usuarioId }, data: { pacotesBonus: { increment: pacotes } } });
  }
  return novas;
}
