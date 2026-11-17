import { Rng } from './tipos';

/** Gerador determinístico (mulberry32) para testes e simulações. Nunca use em produção:
 * o sorteio de verdade usa o gerador criptográfico da API. */
export function rngComSemente(semente: number): Rng {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
