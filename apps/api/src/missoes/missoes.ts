import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { diaLocal, proximaMeiaNoite } from '../pacotes/dia';
import { CONFIG_ECONOMIA } from '../pacotes/economia';

const DADOS_DIR = process.env.DADOS_DIR ?? resolve(__dirname, '../../../../data/temporada1');

export type TipoMissao = 'ABRIR_PACOTES' | 'COLAR_NOVAS' | 'TIRAR_RARA' | 'USAR_BALCAO' | 'PROPOR_TROCA' | 'CONCLUIR_TROCA';
export type Exigencia = 'AMIGOS' | 'REPETIDAS_PARA_BALCAO';

export interface DefinicaoMissao {
  id: string;
  tipo: TipoMissao;
  meta: number;
  recompensa: number;
  titulo: string;
  exige: Exigencia | null;
}

export interface ConfigMissoes {
  missoesPorDia: number;
  fixas: string[];
  pool: DefinicaoMissao[];
}

export const CONFIG_MISSOES: ConfigMissoes = JSON.parse(readFileSync(resolve(DADOS_DIR, 'missoes.json'), 'utf8'));
const POR_ID = new Map(CONFIG_MISSOES.pool.map((m) => [m.id, m]));

type Tx = Prisma.TransactionClient;

/**
 * Escolhe as missões do dia: as fixas mais sorteadas entre as que o jogador
 * consegue cumprir, sem repetir tipo. A semente (jogador + dia) deixa o
 * sorteio estável e diferente para cada jogador.
 */
export function escolherMissoes(config: ConfigMissoes, atende: (e: Exigencia) => boolean, semente: string): DefinicaoMissao[] {
  const fixas = config.fixas.map((id) => POR_ID.get(id) ?? config.pool.find((m) => m.id === id)!).filter(Boolean);
  const peso = (id: string) => createHash('sha256').update(`${semente}:${id}`).digest().readUInt32BE(0);
  const candidatas = config.pool
    .filter((m) => !config.fixas.includes(m.id) && (!m.exige || atende(m.exige)))
    .sort((a, b) => peso(a.id) - peso(b.id));
  const escolhidas = [...fixas];
  for (const m of candidatas) {
    if (escolhidas.length >= config.missoesPorDia) break;
    if (!escolhidas.some((e) => e.tipo === m.tipo)) escolhidas.push(m);
  }
  return escolhidas;
}

/**
 * Cria as missões do dia do jogador, se ainda não existirem.
 * Quem chama deve ter travado a linha do jogador (evita sortear duas vezes).
 */
export async function garantirMissoesDoDia(tx: Tx, usuarioId: string, agora = new Date()) {
  const dia = diaLocal(agora);
  const existentes = await tx.missaoDia.findMany({ where: { usuarioId, dia }, orderBy: { ordem: 'asc' } });
  if (existentes.length) return existentes;

  const [amigos, balcao] = await Promise.all([
    tx.amizade.count({ where: { status: 'ACEITA', OR: [{ solicitanteId: usuarioId }, { destinatarioId: usuarioId }] } }),
    tx.$queryRaw<{ ok: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM "ItemAlbum" i JOIN "Figurinha" f ON f."codigo" = i."figurinhaCodigo"
        WHERE i."usuarioId" = ${usuarioId}
        GROUP BY f."raridade"
        HAVING SUM(i."quantidade" - 1) >= ${CONFIG_ECONOMIA.balcao.repetidasPorNova}
      ) AS ok`,
  ]);
  const atende = (e: Exigencia) => (e === 'AMIGOS' ? amigos > 0 : balcao[0]?.ok === true);
  const escolhidas = escolherMissoes(CONFIG_MISSOES, atende, `${usuarioId}:${dia}`);
  await tx.missaoDia.createMany({
    data: escolhidas.map((m, ordem) => ({
      usuarioId,
      dia,
      missaoId: m.id,
      tipo: m.tipo,
      ordem,
      meta: m.meta,
      recompensa: m.recompensa,
    })),
    skipDuplicates: true,
  });
  return tx.missaoDia.findMany({ where: { usuarioId, dia }, orderBy: { ordem: 'asc' } });
}

/**
 * Soma progresso nas missões de hoje do tipo informado. Chamado dentro das
 * transações de pacote, balcão e troca (com a linha do jogador já travada).
 */
export async function registrarProgresso(tx: Tx, usuarioId: string, tipo: TipoMissao, quantidade: number, agora = new Date()) {
  if (quantidade <= 0) return;
  await garantirMissoesDoDia(tx, usuarioId, agora);
  await tx.$executeRaw`
    UPDATE "MissaoDia" SET "progresso" = LEAST("meta", "progresso" + ${quantidade})
    WHERE "usuarioId" = ${usuarioId} AND "dia" = ${diaLocal(agora)} AND "tipo" = ${tipo} AND "resgatadaEm" IS NULL`;
}

export function apresentar(m: { missaoId: string; meta: number; progresso: number; recompensa: number; resgatadaEm: Date | null }) {
  return {
    id: m.missaoId,
    titulo: POR_ID.get(m.missaoId)?.titulo ?? m.missaoId,
    meta: m.meta,
    progresso: m.progresso,
    recompensa: m.recompensa,
    concluida: m.progresso >= m.meta,
    resgatada: !!m.resgatadaEm,
  };
}

export const renovaEm = (agora: Date) => proximaMeiaNoite(agora);
