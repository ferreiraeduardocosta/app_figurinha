import { ErroRegra } from './erros';
import { Rng } from './tipos';

/**
 * Bafo: cada lado põe de 1 a 3 figurinhas repetidas num monte, viradas para baixo.
 * Na sua vez, o jogador bate no monte; cada carta ainda virada para baixo vira com
 * uma chance que cresce com a precisão da batida (0 a 1). As que virarem ficam com
 * quem bateu. Cada lado bate 3 vezes (ordem A B B A A B); o que sobrar volta para o dono.
 */

export type LadoBafo = 'A' | 'B';

export interface CartaBafo {
  codigo: string;
  dono: LadoBafo;
  /** Quem virou a carta (e ficou com ela); null enquanto está para baixo. */
  virou: LadoBafo | null;
}

export interface BatidaBafo {
  lado: LadoBafo;
  precisao: number;
  /** Posições no monte das cartas que viraram nesta batida. */
  viradas: number[];
}

export interface EstadoBafo {
  monte: CartaBafo[];
  vez: LadoBafo;
  batidas: BatidaBafo[];
  terminou: boolean;
}

export const BAFO = {
  maxCartasPorLado: 3,
  batidasPorLado: 3,
  /** Chance de cada carta virar: base + bônus × precisão. */
  chanceBase: 0.08,
  chanceBonus: 0.3,
  /** A partir desta precisão é "bafo perfeito": vira pelo menos uma carta. */
  perfeito: 0.95,
  /** Partidas por dia contra o computador. Entre amigos não há limite. */
  partidasPorDiaComputador: 10,
} as const;

/**
 * Ordem das batidas: A, B, B, A, A, B. Como na escolha de time da várzea,
 * alternar assim tira quase toda a vantagem de quem começa.
 */
export const ORDEM_BAFO: readonly LadoBafo[] = ['A', 'B', 'B', 'A', 'A', 'B'];

export function chanceDeVirar(precisao: number): number {
  return BAFO.chanceBase + BAFO.chanceBonus * limitarPrecisao(precisao);
}

export function limitarPrecisao(precisao: number): number {
  if (!Number.isFinite(precisao)) return 0;
  return Math.min(1, Math.max(0, precisao));
}

/** Monta o monte com as cartas dos dois lados, embaralhadas. */
export function montarMonte(cartasA: readonly string[], cartasB: readonly string[], rng: Rng): EstadoBafo {
  for (const [lado, cartas] of [['A', cartasA], ['B', cartasB]] as const) {
    if (cartas.length < 1 || cartas.length > BAFO.maxCartasPorLado) {
      throw new ErroRegra('BAFO_INVALIDO', `Cada lado põe de 1 a ${BAFO.maxCartasPorLado} figurinhas (lado ${lado}).`);
    }
  }
  if (cartasA.length !== cartasB.length) {
    throw new ErroRegra('BAFO_INVALIDO', 'Os dois lados põem a mesma quantidade de figurinhas.');
  }
  const monte: CartaBafo[] = [
    ...cartasA.map((codigo) => ({ codigo, dono: 'A' as const, virou: null })),
    ...cartasB.map((codigo) => ({ codigo, dono: 'B' as const, virou: null })),
  ];
  for (let i = monte.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [monte[i], monte[j]] = [monte[j], monte[i]];
  }
  return { monte, vez: 'A', batidas: [], terminou: false };
}

/** Uma batida de `lado`. Devolve o novo estado (não altera o recebido). */
export function bater(estado: EstadoBafo, lado: LadoBafo, precisao: number, rng: Rng): EstadoBafo {
  if (estado.terminou) throw new ErroRegra('BAFO_INVALIDO', 'A partida já acabou.');
  if (estado.vez !== lado) throw new ErroRegra('BAFO_INVALIDO', 'Não é a sua vez.');
  const p = limitarPrecisao(precisao);
  const chance = chanceDeVirar(p);
  const monte = estado.monte.map((c) => ({ ...c }));
  const paraBaixo = monte.map((c, i) => (c.virou ? -1 : i)).filter((i) => i >= 0);
  const viradas: number[] = [];
  for (const i of paraBaixo) {
    if (rng() < chance) viradas.push(i);
  }
  if (viradas.length === 0 && p >= BAFO.perfeito && paraBaixo.length > 0) {
    viradas.push(paraBaixo[Math.floor(rng() * paraBaixo.length)]);
  }
  for (const i of viradas) monte[i].virou = lado;

  const batidas = [...estado.batidas, { lado, precisao: p, viradas }];
  const acabaramAsBatidas = batidas.length >= ORDEM_BAFO.length;
  const acabouOMonte = monte.every((c) => c.virou);
  return {
    monte,
    batidas,
    vez: ORDEM_BAFO[batidas.length] ?? 'A',
    terminou: acabaramAsBatidas || acabouOMonte,
  };
}

/**
 * Quem fica com o quê no fim: as cartas que cada lado virou, mais as suas
 * que ninguém virou (voltam para o dono).
 */
export function resultadoBafo(estado: EstadoBafo): Record<LadoBafo, { ganhou: string[]; devolvidas: string[]; recebe: string[] }> {
  const r = {
    A: { ganhou: [] as string[], devolvidas: [] as string[], recebe: [] as string[] },
    B: { ganhou: [] as string[], devolvidas: [] as string[], recebe: [] as string[] },
  };
  for (const c of estado.monte) {
    if (c.virou) r[c.virou].ganhou.push(c.codigo);
    else r[c.dono].devolvidas.push(c.codigo);
  }
  for (const lado of ['A', 'B'] as const) r[lado].recebe = [...r[lado].ganhou, ...r[lado].devolvidas];
  return r;
}

/** Precisão do computador: varia a cada batida, em média um pouco acima de 0,6. */
export function precisaoDoComputador(rng: Rng): number {
  return 0.35 + 0.55 * rng();
}
