import { describe, expect, it } from 'vitest';
import { BAFO, ErroRegra, bater, chanceDeVirar, montarMonte, precisaoDoComputador, resultadoBafo, rngComSemente } from '../src';

const codigoErro = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as ErroRegra).codigo;
  }
  return null;
};

/** Joga uma partida inteira com precisões fixas para cada lado. */
function jogar(pA: number, pB: number, semente: number, n = 3) {
  const rng = rngComSemente(semente);
  const a = Array.from({ length: n }, (_, i) => `A-${i}`);
  const b = Array.from({ length: n }, (_, i) => `B-${i}`);
  let e = montarMonte(a, b, rng);
  while (!e.terminou) e = bater(e, e.vez, e.vez === 'A' ? pA : pB, rng);
  return e;
}

describe('bafo', () => {
  it('monta o monte com as cartas dos dois lados, todas para baixo', () => {
    const e = montarMonte(['X', 'Y'], ['Z', 'W'], rngComSemente(1));
    expect(e.monte).toHaveLength(4);
    expect(e.monte.every((c) => c.virou === null)).toBe(true);
    expect(e.monte.filter((c) => c.dono === 'A').map((c) => c.codigo).sort()).toEqual(['X', 'Y']);
    expect(e.vez).toBe('A');
  });

  it('exige de 1 a 3 figurinhas e a mesma quantidade dos dois lados', () => {
    const rng = rngComSemente(1);
    expect(codigoErro(() => montarMonte([], ['Z'], rng))).toBe('BAFO_INVALIDO');
    expect(codigoErro(() => montarMonte(['1', '2', '3', '4'], ['5', '6', '7', '8'], rng))).toBe('BAFO_INVALIDO');
    expect(codigoErro(() => montarMonte(['1', '2'], ['3'], rng))).toBe('BAFO_INVALIDO');
  });

  it('respeita a vez e não deixa bater depois do fim', () => {
    const rng = rngComSemente(2);
    const e = montarMonte(['X'], ['Y'], rng);
    expect(codigoErro(() => bater(e, 'B', 1, rng))).toBe('BAFO_INVALIDO');
    const fim = jogar(1, 1, 3, 1);
    expect(fim.terminou).toBe(true);
    expect(codigoErro(() => bater(fim, fim.vez, 1, rng))).toBe('BAFO_INVALIDO');
  });

  it('termina depois de 3 batidas de cada lado ou quando todas viram', () => {
    for (let s = 0; s < 200; s++) {
      const e = jogar(0, 0, s);
      expect(e.terminou).toBe(true);
      expect(e.batidas.length === BAFO.batidasPorLado * 2 || e.monte.every((c) => c.virou)).toBe(true);
      expect(e.batidas.length).toBeLessThanOrEqual(BAFO.batidasPorLado * 2);
    }
  });

  it('no verde vira pelo menos uma carta; no dourado é Bafo de Ouro e vira pelo menos duas', () => {
    for (let s = 0; s < 300; s++) {
      const rng = rngComSemente(s);
      const verde = bater(montarMonte(['X', 'Y', 'Z'], ['1', '2', '3'], rng), 'A', BAFO.verde, rng);
      expect(verde.batidas[0].viradas.length).toBeGreaterThanOrEqual(1);
      const ouro = bater(montarMonte(['X', 'Y', 'Z'], ['1', '2', '3'], rng), 'A', 1, rng);
      expect(ouro.batidas[0].especial).toBe(true);
      expect(ouro.batidas[0].viradas.length).toBeGreaterThanOrEqual(2);
      const fora = bater(montarMonte(['X', 'Y', 'Z'], ['1', '2', '3'], rng), 'A', 0.5, rng);
      expect(fora.batidas[0].especial).toBeUndefined();
    }
  });

  it('no verde, o Bafo de Ouro sai por sorte em cerca de 15% das vezes', () => {
    let n = 0;
    const N = 4000;
    for (let s = 0; s < N; s++) {
      const rng = rngComSemente(s + 7000);
      if (bater(montarMonte(['X'], ['Y'], rng), 'A', 0.9, rng).batidas[0].especial) n++;
    }
    expect(n / N).toBeGreaterThan(0.12);
    expect(n / N).toBeLessThan(0.18);
  });

  it('bafo perfeito vira pelo menos uma carta', () => {
    for (let s = 0; s < 200; s++) {
      const rng = rngComSemente(s);
      const e = bater(montarMonte(['X', 'Y', 'Z'], ['1', '2', '3'], rng), 'A', 1, rng);
      expect(e.batidas[0].viradas.length).toBeGreaterThan(0);
    }
  });

  it('não altera o estado recebido', () => {
    const rng = rngComSemente(5);
    const e = montarMonte(['X', 'Y'], ['Z', 'W'], rng);
    const copia = JSON.stringify(e);
    bater(e, 'A', 1, rng);
    expect(JSON.stringify(e)).toBe(copia);
  });

  it('nenhuma carta some nem aparece: cada uma vai para um lado', () => {
    for (let s = 0; s < 200; s++) {
      const e = jogar(Math.random(), Math.random(), s);
      const r = resultadoBafo(e);
      const todas = [...r.A.recebe, ...r.B.recebe].sort();
      expect(todas).toEqual(e.monte.map((c) => c.codigo).sort());
    }
  });

  it('precisão maior ganha mais, e o jogo é simétrico com a mesma precisão', () => {
    let saldoIgual = 0;
    let saldoMelhor = 0;
    const N = 4000;
    for (let s = 0; s < N; s++) {
      const igual = resultadoBafo(jogar(0.6, 0.6, s));
      saldoIgual += igual.A.recebe.length - 3;
      const melhor = resultadoBafo(jogar(0.9, 0.4, s + N));
      saldoMelhor += melhor.A.recebe.length - 3;
    }
    // Quem começa tem uma pequena vantagem; ela precisa ser pequena.
    expect(Math.abs(saldoIgual / N)).toBeLessThan(0.25);
    expect(saldoMelhor / N).toBeGreaterThan(0.4);
  });

  it('chance de virar vai de 8% a 40% e ignora precisões fora de 0..1', () => {
    expect(chanceDeVirar(0)).toBeCloseTo(0.08);
    expect(chanceDeVirar(1)).toBeCloseTo(0.40);
    expect(chanceDeVirar(7)).toBeCloseTo(0.40);
    expect(chanceDeVirar(Number.NaN)).toBeCloseTo(0.08);
  });

  it('precisão do computador fica entre 0,35 e 0,9', () => {
    const rng = rngComSemente(9);
    for (let i = 0; i < 1000; i++) {
      const p = precisaoDoComputador(rng);
      expect(p).toBeGreaterThanOrEqual(0.35);
      expect(p).toBeLessThan(0.9);
    }
  });
});

describe('ordem do bafo', () => {
  it('alterna A B B A A B', async () => {
    const { ORDEM_BAFO } = await import('../src');
    const e = jogar(0, 0, 11);
    expect(e.batidas.map((b) => b.lado)).toEqual(ORDEM_BAFO.slice(0, e.batidas.length));
  });
});
