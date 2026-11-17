import { describe, expect, it } from 'vitest';
import { rngSeguro } from '../src/pacotes/rng-seguro';

describe('rngSeguro', () => {
  it('gera números em [0, 1) bem espalhados', () => {
    const amostras = Array.from({ length: 20_000 }, rngSeguro);
    expect(amostras.every((x) => x >= 0 && x < 1)).toBe(true);
    const media = amostras.reduce((s, x) => s + x, 0) / amostras.length;
    expect(media).toBeCloseTo(0.5, 1);
    const faixas = new Array(10).fill(0);
    for (const x of amostras) faixas[Math.floor(x * 10)]++;
    expect(Math.min(...faixas)).toBeGreaterThan(1_700);
  });
});
