import { describe, expect, it } from 'vitest';
import figurinhas from '../../../data/temporada1/figurinhas.json';
import clubes from '../../../data/temporada1/clubes.json';
import { TimeLiga, classificar, craqueDaRodada, forcaDoTime, gerarCalendario, simularPartida, simularRodada, rngComSemente } from '../src';

const siglas = clubes.map((c) => c.sigla);
const times: Record<string, TimeLiga> = Object.fromEntries(
  siglas.map((s) => [
    s,
    {
      sigla: s,
      jogadores: figurinhas
        .filter((f) => f.clube === s && f.tipo === 'JOGADOR' && 'atributos' in f)
        .map((f) => ({
          codigo: f.codigo,
          posicao: f.posicao!,
          ataque: f.atributos!.ata,
          defesa: f.atributos!.def,
          tecnica: f.atributos!.tec,
          velocidade: f.atributos!.vel,
          fisico: f.atributos!.fis,
        })),
    },
  ]),
);

describe('calendário', () => {
  const cal = gerarCalendario(siglas);

  it('14 rodadas de 4 jogos; cada time joga uma vez por rodada', () => {
    expect(cal).toHaveLength(56);
    for (let r = 1; r <= 14; r++) {
      const jogos = cal.filter((p) => p.rodada === r);
      expect(jogos).toHaveLength(4);
      expect(new Set(jogos.flatMap((p) => [p.mandante, p.visitante])).size).toBe(8);
    }
  });

  it('cada par se enfrenta duas vezes, uma em cada mando; 7 jogos em casa para cada time', () => {
    const confrontos = new Set(cal.map((p) => `${p.mandante}x${p.visitante}`));
    expect(confrontos.size).toBe(56);
    for (const a of siglas) for (const b of siglas) if (a !== b) expect(confrontos.has(`${a}x${b}`)).toBe(true);
    for (const s of siglas) expect(cal.filter((p) => p.mandante === s)).toHaveLength(7);
  });

  it('recusa número ímpar de times', () => {
    expect(() => gerarCalendario(['A', 'B', 'C'])).toThrow();
  });
});

describe('simulação', () => {
  it('é determinística para a mesma semente', () => {
    const cal = gerarCalendario(siglas).filter((p) => p.rodada === 1);
    expect(simularRodada(times, cal, 'teste')).toEqual(simularRodada(times, cal, 'teste'));
    expect(simularRodada(times, cal, 'teste')).not.toEqual(simularRodada(times, cal, 'outra'));
  });

  it('gols batem com o placar e saem de jogadores do próprio time', () => {
    const rng = rngComSemente(9);
    for (let i = 0; i < 200; i++) {
      const r = simularPartida(times.UNI, times.CAP, rng);
      expect(r.gols.filter((g) => g.sigla === 'UNI')).toHaveLength(r.golsMandante);
      expect(r.gols.filter((g) => g.sigla === 'CAP')).toHaveLength(r.golsVisitante);
      for (const g of r.gols) expect(g.codigo.startsWith(g.sigla)).toBe(true);
    }
  });

  it('placares realistas: média de 2 a 3,5 gols por jogo e mandante vence mais', () => {
    const rng = rngComSemente(3);
    let gols = 0;
    let vitoriasCasa = 0;
    let vitoriasFora = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const [a, b] = [siglas[i % 8], siglas[(i * 3 + 1) % 8]];
      if (a === b) continue;
      const r = simularPartida(times[a], times[b], rng);
      gols += r.golsMandante + r.golsVisitante;
      if (r.golsMandante > r.golsVisitante) vitoriasCasa++;
      if (r.golsMandante < r.golsVisitante) vitoriasFora++;
    }
    expect(gols / n).toBeGreaterThan(2);
    expect(gols / n).toBeLessThan(3.5);
    expect(vitoriasCasa).toBeGreaterThan(vitoriasFora);
  });

  it('forças ficam na escala dos atributos', () => {
    for (const s of siglas) {
      const f = forcaDoTime(times[s]);
      expect(f.ataque).toBeGreaterThan(30);
      expect(f.ataque).toBeLessThan(99);
      expect(f.defesa).toBeGreaterThan(30);
      expect(f.defesa).toBeLessThan(99);
    }
  });
});

describe('classificação e craque', () => {
  const r = [
    { mandante: 'UNI', visitante: 'CAP', golsMandante: 2, golsVisitante: 1, gols: [] },
    { mandante: 'TUB', visitante: 'SER', golsMandante: 0, golsVisitante: 0, gols: [] },
    { mandante: 'CAP', visitante: 'TUB', golsMandante: 3, golsVisitante: 0, gols: [] },
  ];

  it('soma pontos, saldo e desempata', () => {
    const t = classificar(['UNI', 'CAP', 'TUB', 'SER'], r);
    expect(t.map((l) => l.sigla)).toEqual(['CAP', 'UNI', 'SER', 'TUB']); // CAP e UNI com 3 pts: CAP tem saldo maior
    expect(t[0]).toMatchObject({ pontos: 3, jogos: 2, vitorias: 1, derrotas: 1, golsPro: 4, golsContra: 2, saldo: 2 });
    expect(t[3]).toMatchObject({ pontos: 1, empates: 1, derrotas: 1, saldo: -3 });
  });

  it('craque é quem fez mais gols; empate pelo ataque', () => {
    const gols = [
      { mandante: 'UNI', visitante: 'CAP', golsMandante: 2, golsVisitante: 1, gols: [
        { sigla: 'UNI', codigo: 'UNI-11', minuto: 10 },
        { sigla: 'UNI', codigo: 'UNI-14', minuto: 20 },
        { sigla: 'CAP', codigo: 'CAP-14', minuto: 30 },
      ] },
    ];
    expect(craqueDaRodada(gols, { 'UNI-11': 69, 'UNI-14': 79, 'CAP-14': 90 })).toEqual({ codigo: 'CAP-14', gols: 1 });
    expect(craqueDaRodada([], {})).toBeNull();
  });
});
