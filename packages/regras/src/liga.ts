import { rngComSemente } from './rng';
import { Rng } from './tipos';

/** Jogador com atributos (vem das figurinhas do tipo JOGADOR). */
export interface JogadorLiga {
  codigo: string;
  posicao: string;
  ataque: number;
  defesa: number;
  tecnica: number;
  velocidade: number;
  fisico: number;
}

export interface TimeLiga {
  sigla: string;
  jogadores: JogadorLiga[];
}

export interface PartidaAgendada {
  rodada: number;
  mandante: string;
  visitante: string;
}

export interface GolMarcado {
  sigla: string;
  codigo: string;
  minuto: number;
}

export interface ResultadoPartida {
  mandante: string;
  visitante: string;
  golsMandante: number;
  golsVisitante: number;
  gols: GolMarcado[];
}

export interface LinhaClassificacao {
  sigla: string;
  pontos: number;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
  saldo: number;
}

/** Hash FNV-1a de 32 bits (para transformar texto em semente). */
export function hashTexto(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Turno e returno pelo método do círculo: cada time joga uma vez por rodada,
 * cada par se enfrenta duas vezes (uma em cada mando). Com 8 times: 14 rodadas.
 */
export function gerarCalendario(siglas: readonly string[]): PartidaAgendada[] {
  if (siglas.length < 2 || siglas.length % 2 !== 0) throw new Error('O calendário precisa de um número par de times (2 ou mais).');
  const n = siglas.length;
  const giro = [...siglas];
  const turno: PartidaAgendada[] = [];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = giro[i];
      const b = giro[n - 1 - i];
      // Alterna o mando por rodada e por posição, para equilibrar o turno.
      const aEmCasa = (i % 2 === 0) === (r % 2 === 0);
      turno.push({ rodada: r + 1, mandante: aEmCasa ? a : b, visitante: aEmCasa ? b : a });
    }
    // Gira todos menos o primeiro.
    giro.splice(1, 0, giro.pop()!);
  }
  const returno = turno.map((p) => ({ rodada: p.rodada + n - 1, mandante: p.visitante, visitante: p.mandante }));
  return [...turno, ...returno];
}

const PESO_ATAQUE: Record<string, number> = { ATA: 3, PON: 2, MEI: 1.5, VOL: 0.5, LAT: 0.5, ZAG: 0.2, GOL: 0 };
const PESO_DEFESA: Record<string, number> = { GOL: 3, ZAG: 2.5, VOL: 2, LAT: 1.5, MEI: 0.5, PON: 0.2, ATA: 0.1 };
const PESO_GOL: Record<string, number> = { ATA: 5, PON: 3, MEI: 2, VOL: 0.7, ZAG: 0.6, LAT: 0.5, GOL: 0.02 };

function mediaPonderada(jogadores: JogadorLiga[], pesos: Record<string, number>, valor: (j: JogadorLiga) => number) {
  let soma = 0;
  let pesoTotal = 0;
  for (const j of jogadores) {
    const p = pesos[j.posicao] ?? 0;
    soma += p * valor(j);
    pesoTotal += p;
  }
  return pesoTotal ? soma / pesoTotal : 50;
}

/** Força de ataque e de defesa do time, na escala dos atributos (30 a 99). */
export function forcaDoTime(time: TimeLiga) {
  return {
    ataque: mediaPonderada(time.jogadores, PESO_ATAQUE, (j) => j.ataque * 0.6 + j.tecnica * 0.25 + j.velocidade * 0.15),
    defesa: mediaPonderada(time.jogadores, PESO_DEFESA, (j) => j.defesa * 0.6 + j.fisico * 0.25 + j.velocidade * 0.15),
  };
}

function poisson(lambda: number, rng: Rng): number {
  const limite = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > limite && k < 15);
  return k - 1;
}

function escolherArtilheiro(time: TimeLiga, rng: Rng): JogadorLiga {
  const pesos = time.jogadores.map((j) => (PESO_GOL[j.posicao] ?? 0.1) * (j.ataque / 60) ** 2);
  const total = pesos.reduce((s, x) => s + x, 0);
  let x = rng() * total;
  for (let i = 0; i < pesos.length; i++) {
    x -= pesos[i];
    if (x < 0) return time.jogadores[i];
  }
  return time.jogadores[time.jogadores.length - 1];
}

/**
 * Simula uma partida. Gols esperados de cada lado crescem com o ataque de um
 * contra a defesa do outro; o mandante tem vantagem de 10%.
 */
export function simularPartida(mandante: TimeLiga, visitante: TimeLiga, rng: Rng): ResultadoPartida {
  const fm = forcaDoTime(mandante);
  const fv = forcaDoTime(visitante);
  const lambda = (atq: number, def: number, casa: number) => Math.min(3.5, Math.max(0.2, 1.3 * Math.exp((atq - def) / 12) * casa));
  const golsMandante = poisson(lambda(fm.ataque, fv.defesa, 1.1), rng);
  const golsVisitante = poisson(lambda(fv.ataque, fm.defesa, 0.9), rng);
  const gols: GolMarcado[] = [];
  for (const [time, qtd] of [
    [mandante, golsMandante],
    [visitante, golsVisitante],
  ] as const) {
    for (let i = 0; i < qtd; i++) {
      gols.push({ sigla: time.sigla, codigo: escolherArtilheiro(time, rng).codigo, minuto: 1 + Math.floor(rng() * 90) });
    }
  }
  gols.sort((a, b) => a.minuto - b.minuto);
  return { mandante: mandante.sigla, visitante: visitante.sigla, golsMandante, golsVisitante, gols };
}

/** Simula as partidas de uma rodada. A mesma semente sempre dá o mesmo resultado. */
export function simularRodada(
  times: Readonly<Record<string, TimeLiga>>,
  partidas: readonly PartidaAgendada[],
  semente: string,
): ResultadoPartida[] {
  return partidas.map((p) => simularPartida(times[p.mandante], times[p.visitante], rngComSemente(hashTexto(`${semente}:${p.rodada}:${p.mandante}`))));
}

/** Tabela: pontos, vitórias, saldo, gols pró e sigla, nessa ordem de desempate. */
export function classificar(siglas: readonly string[], resultados: readonly ResultadoPartida[]): LinhaClassificacao[] {
  const t: Record<string, LinhaClassificacao> = Object.fromEntries(
    siglas.map((s) => [s, { sigla: s, pontos: 0, jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0, saldo: 0 }]),
  );
  for (const r of resultados) {
    const m = t[r.mandante];
    const v = t[r.visitante];
    m.jogos++;
    v.jogos++;
    m.golsPro += r.golsMandante;
    m.golsContra += r.golsVisitante;
    v.golsPro += r.golsVisitante;
    v.golsContra += r.golsMandante;
    if (r.golsMandante > r.golsVisitante) {
      m.vitorias++;
      m.pontos += 3;
      v.derrotas++;
    } else if (r.golsMandante < r.golsVisitante) {
      v.vitorias++;
      v.pontos += 3;
      m.derrotas++;
    } else {
      m.empates++;
      v.empates++;
      m.pontos++;
      v.pontos++;
    }
  }
  return Object.values(t)
    .map((l) => ({ ...l, saldo: l.golsPro - l.golsContra }))
    .sort((a, b) => b.pontos - a.pontos || b.vitorias - a.vitorias || b.saldo - a.saldo || b.golsPro - a.golsPro || a.sigla.localeCompare(b.sigla));
}

/** Craque da rodada: quem fez mais gols; empate decidido pelo maior ataque, depois pelo código. */
export function craqueDaRodada(resultados: readonly ResultadoPartida[], ataquePorCodigo: Readonly<Record<string, number>>) {
  const gols: Record<string, number> = {};
  for (const r of resultados) for (const g of r.gols) gols[g.codigo] = (gols[g.codigo] ?? 0) + 1;
  const [codigo] =
    Object.keys(gols).sort((a, b) => gols[b] - gols[a] || (ataquePorCodigo[b] ?? 0) - (ataquePorCodigo[a] ?? 0) || a.localeCompare(b)) ?? [];
  return codigo ? { codigo, gols: gols[codigo] } : null;
}
