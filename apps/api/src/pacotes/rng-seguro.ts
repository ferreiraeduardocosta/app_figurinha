import { randomInt } from 'node:crypto';
import { Rng } from '@liga-aurora/regras';

/** Gerador criptográfico usado no sorteio de verdade. */
export const rngSeguro: Rng = () => randomInt(0, 2 ** 48) / 2 ** 48;
