import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Pasta das artes (apps/api/artes), a mesma rodando de src/ ou de dist/. */
export const PASTA_ARTES = resolve(__dirname, '../../artes');

/**
 * Código da figurinha -> arquivo da arte (com hash no nome, gerado por
 * tools/artes/preparar_artes.py). Figurinha sem arte fica com o desenho provisório do app.
 */
const manifesto: Record<string, string> = existsSync(resolve(PASTA_ARTES, 'manifest.json'))
  ? JSON.parse(readFileSync(resolve(PASTA_ARTES, 'manifest.json'), 'utf8'))
  : {};

export function imagemDa(codigo: string): string | null {
  const arquivo = manifesto[codigo];
  return arquivo ? `/artes/${arquivo}` : null;
}

export function comImagem<T extends { codigo: string }>(f: T): T & { imagem: string | null } {
  return { ...f, imagem: imagemDa(f.codigo) };
}
