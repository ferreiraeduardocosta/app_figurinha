import { randomBytes } from 'node:crypto';
import { Rng } from '@craques-da-varzea/regras';

const DOIS_A_48 = 2 ** 48;

/** Gerador criptográfico usado no sorteio de verdade: 48 bits aleatórios em [0, 1). */
export const rngSeguro: Rng = () => randomBytes(6).readUIntBE(0, 6) / DOIS_A_48;
