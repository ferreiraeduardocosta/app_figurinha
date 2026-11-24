import { ErroRegra } from './erros';
import { Rng } from './tipos';

/**
 * Bafo: cada lado põe de 1 a 3 figurinhas repetidas num monte, viradas para baixo.
 * Na sua vez, o jogador bate no monte; cada carta ainda virada para baixo vira com
 * uma chance que cresce com a precisão da batida (0 a 1). As que virarem ficam com
 * quem bateu. Cada lado bate 3 vezes (ordem A B B A A B); o que sobrar volta para o dono.
 */

/** Lado de cada jogador no monte: 'A' e 'B' no 1 contra 1; de 'A' a 'F' na rodinha. */
export type LadoBafo = string;
export const LADOS_RODA = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

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
  /** "Bafo de Ouro": acertou o centro (ou teve sorte no verde) e virou mais cartas. */
  especial?: boolean;
}

export interface EstadoBafo {
  monte: CartaBafo[];
  vez: LadoBafo;
  batidas: BatidaBafo[];
  terminou: boolean;
  /** Ordem das batidas (rodinha). Sem ela, vale ORDEM_BAFO (1 contra 1). */
  ordem?: LadoBafo[];
  /**
   * Multiplicador da chance de virar (rodinha). Com mais gente o monte é maior e quem
   * bate primeiro levaria quase tudo; a chance menor espalha as cartas entre as batidas.
   */
  fatorChance?: number;
}

export const BAFO = {
  maxCartasPorLado: 3,
  batidasPorLado: 3,
  /** Chance de cada carta virar: base + bônus × precisão. */
  chanceBase: 0.08,
  chanceBonus: 0.32,
  /** Soltou no verde: vira pelo menos uma carta. */
  verde: 0.85,
  /** Soltou no ponto dourado do centro: Bafo de Ouro garantido. */
  ouro: 0.97,
  /** No verde (fora do dourado), chance de o Bafo de Ouro sair mesmo assim. */
  sorteOuro: 0.15,
  /** Bafo de Ouro: chance de cada carta virar dobra e vira pelo menos 2. */
  multiplicadorOuro: 2,
  minimoOuro: 2,
  /** Partidas por dia contra o computador. Entre amigos não há limite. */
  partidasPorDiaComputador: 10,
  /** Rodinha: de 3 a 6 jogadores. */
  minRoda: 3,
  maxRoda: 6,
} as const;

/**
 * Ordem das batidas: A, B, B, A, A, B. Como na escolha de time da várzea,
 * alternar assim tira quase toda a vantagem de quem começa.
 */
export const ORDEM_BAFO: readonly LadoBafo[] = ['A', 'B', 'B', 'A', 'A', 'B'];

/**
 * Ordem "em cobrinha" de uma rodinha: A B C, C B A, A B C (3 batidas cada).
 * Com 2 jogadores é a própria ORDEM_BAFO.
 */
export function ordemRoda(lados: readonly LadoBafo[]): LadoBafo[] {
  const ida = [...lados];
  const volta = [...lados].reverse();
  return [...ida, ...volta, ...ida];
}

/** Monta o monte de uma rodinha: cada mão é a lista de figurinhas de um jogador (mesma quantidade). */
export function montarRoda(maos: readonly (readonly string[])[], rng: Rng): EstadoBafo {
  if (maos.length < 2 || maos.length > BAFO.maxRoda) {
    throw new ErroRegra('BAFO_INVALIDO', `A rodinha tem de 2 a ${BAFO.maxRoda} jogadores.`);
  }
  const n = maos[0].length;
  if (n < 1 || n > BAFO.maxCartasPorLado || maos.some((m) => m.length !== n)) {
    throw new ErroRegra('BAFO_INVALIDO', `Todos põem a mesma quantidade de figurinhas (de 1 a ${BAFO.maxCartasPorLado}).`);
  }
  const lados = LADOS_RODA.slice(0, maos.length);
  const monte: CartaBafo[] = maos.flatMap((m, i) => m.map((codigo) => ({ codigo, dono: lados[i], virou: null })));
  for (let i = monte.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [monte[i], monte[j]] = [monte[j], monte[i]];
  }
  const ordem = ordemRoda(lados);
  return { monte, vez: ordem[0], batidas: [], terminou: false, ordem, fatorChance: FATOR_RODA[maos.length] ?? 1 };
}

/** Multiplicador da chance por tamanho da rodinha (calibrado por simulação). */
export const FATOR_RODA: Record<number, number> = { 2: 1, 3: 0.55, 4: 0.4, 5: 0.32, 6: 0.27 };

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
  const especial = p >= BAFO.ouro || (p >= BAFO.verde && rng() < BAFO.sorteOuro);
  const chance = Math.min(0.95, chanceDeVirar(p) * (especial ? BAFO.multiplicadorOuro : 1) * (estado.fatorChance ?? 1));
  const monte = estado.monte.map((c) => ({ ...c }));
  const paraBaixo = monte.map((c, i) => (c.virou ? -1 : i)).filter((i) => i >= 0);
  const viradas: number[] = [];
  for (const i of paraBaixo) {
    if (rng() < chance) viradas.push(i);
  }
  // Garantias: verde vira pelo menos 1; Bafo de Ouro pelo menos 2 (se houver).
  const minimo = especial ? BAFO.minimoOuro : p >= BAFO.verde ? 1 : 0;
  const restantes = paraBaixo.filter((i) => !viradas.includes(i));
  while (viradas.length < minimo && restantes.length > 0) {
    viradas.push(restantes.splice(Math.floor(rng() * restantes.length), 1)[0]);
  }
  for (const i of viradas) monte[i].virou = lado;

  const batidas = [...estado.batidas, { lado, precisao: p, viradas, ...(especial ? { especial: true } : {}) }];
  const ordem = estado.ordem ?? ORDEM_BAFO;
  const acabaramAsBatidas = batidas.length >= ordem.length;
  const acabouOMonte = monte.every((c) => c.virou);
  return {
    ...(estado.ordem ? { ordem: estado.ordem } : {}),
    ...(estado.fatorChance ? { fatorChance: estado.fatorChance } : {}),
    monte,
    batidas,
    vez: ordem[batidas.length] ?? ordem[0],
    terminou: acabaramAsBatidas || acabouOMonte,
  };
}

/** Pula a vez de um jogador (saiu da rodinha ou deixou o prazo passar): conta como batida sem virar nada. */
export function pularVez(estado: EstadoBafo): EstadoBafo {
  if (estado.terminou) return estado;
  const ordem = estado.ordem ?? ORDEM_BAFO;
  const batidas = [...estado.batidas, { lado: estado.vez, precisao: 0, viradas: [] }];
  return {
    ...estado,
    batidas,
    vez: ordem[batidas.length] ?? ordem[0],
    terminou: batidas.length >= ordem.length || estado.monte.every((c) => c.virou),
  };
}

/**
 * Quem fica com o quê no fim: as cartas que cada lado virou, mais as suas
 * que ninguém virou (voltam para o dono).
 */
export function resultadoBafo(estado: EstadoBafo): Record<LadoBafo, { ganhou: string[]; devolvidas: string[]; recebe: string[] }> {
  const lados = new Set<LadoBafo>(['A', 'B', ...estado.monte.map((c) => c.dono)]);
  const r: Record<LadoBafo, { ganhou: string[]; devolvidas: string[]; recebe: string[] }> = {};
  for (const l of lados) r[l] = { ganhou: [], devolvidas: [], recebe: [] };
  for (const c of estado.monte) {
    if (c.virou) r[c.virou].ganhou.push(c.codigo);
    else r[c.dono].devolvidas.push(c.codigo);
  }
  for (const l of lados) r[l].recebe = [...r[l].ganhou, ...r[l].devolvidas];
  return r;
}

/** Precisão do computador: varia a cada batida, em média um pouco acima de 0,6. */
export function precisaoDoComputador(rng: Rng): number {
  return 0.35 + 0.55 * rng();
}
