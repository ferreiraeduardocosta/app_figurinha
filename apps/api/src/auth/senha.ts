import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (senha: string, sal: Buffer, tamanho: number, opcoes: object) => Promise<Buffer>;

// Parâmetros do scrypt (padrão recomendado pelo Node; ~50 ms por verificação).
const N = 16384;
const R = 8;
const P = 1;
const TAMANHO = 64;

/** Gera "scrypt$N$r$p$sal$hash" (sal e hash em base64url). */
export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scrypt(senha.normalize('NFKC'), sal, TAMANHO, { N, r: R, p: P });
  return ['scrypt', N, R, P, sal.toString('base64url'), hash.toString('base64url')].join('$');
}

export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const [algoritmo, n, r, p, sal, hash] = guardado.split('$');
  if (algoritmo !== 'scrypt' || !sal || !hash) return false;
  const esperado = Buffer.from(hash, 'base64url');
  const calculado = await scrypt(senha.normalize('NFKC'), Buffer.from(sal, 'base64url'), esperado.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

/** Hash fixo usado quando o e-mail não existe, para o tempo de resposta não revelar isso. */
export const HASH_FALSO = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86);
