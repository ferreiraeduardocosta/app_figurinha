import { ErroRegra } from './erros';
import { CatalogoPorRaridade } from './sorteio';
import { Inventario, RARIDADES, Raridade } from './tipos';

/** Uma figurinha (e quantas cópias) em um dos lados da troca. */
export interface ItemTroca {
  codigo: string;
  quantidade: number;
}

/** Máximo de cópias somadas em cada lado de uma proposta. */
export const MAX_COPIAS_POR_LADO = 5;

function raridadeDe(catalogo: CatalogoPorRaridade, codigo: string): Raridade | undefined {
  return RARIDADES.find((r) => catalogo[r].some((f) => f.codigo === codigo));
}

const repetidas = (inv: Inventario, codigo: string) => Math.max(0, (inv[codigo] ?? 0) - 1);

function validarLado(inv: Inventario, itens: readonly ItemTroca[], catalogo: CatalogoPorRaridade, quem: string) {
  if (itens.length === 0) throw new ErroRegra('TROCA_INVALIDA', `A proposta precisa ter ao menos uma figurinha de ${quem}.`);
  const vistos = new Set<string>();
  let total = 0;
  for (const { codigo, quantidade } of itens) {
    if (!raridadeDe(catalogo, codigo)) throw new ErroRegra('FIGURINHA_INEXISTENTE', `Figurinha ${codigo} não existe.`);
    if (vistos.has(codigo)) throw new ErroRegra('TROCA_INVALIDA', `Figurinha ${codigo} repetida na lista.`);
    vistos.add(codigo);
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      throw new ErroRegra('TROCA_INVALIDA', `Quantidade inválida para ${codigo}.`);
    }
    if (repetidas(inv, codigo) < quantidade) {
      throw new ErroRegra('SEM_REPETIDA', `${quem} não tem ${quantidade} repetida(s) de ${codigo}.`);
    }
    total += quantidade;
  }
  if (total > MAX_COPIAS_POR_LADO) {
    throw new ErroRegra('TROCA_INVALIDA', `No máximo ${MAX_COPIAS_POR_LADO} figurinhas de cada lado.`);
  }
}

/**
 * Confere uma proposta: quem propõe (A) oferece repetidas suas e pede repetidas
 * de B. Só repetidas entram em troca: ninguém perde a última cópia de nada.
 */
export function validarTroca(
  invA: Inventario,
  invB: Inventario,
  oferta: readonly ItemTroca[],
  pedido: readonly ItemTroca[],
  catalogo: CatalogoPorRaridade,
): void {
  validarLado(invA, oferta, catalogo, 'Quem propõe');
  validarLado(invB, pedido, catalogo, 'Quem recebe a proposta');
  const ofertados = new Set(oferta.map((i) => i.codigo));
  const repetido = pedido.find((i) => ofertados.has(i.codigo));
  if (repetido) throw new ErroRegra('TROCA_INVALIDA', `${repetido.codigo} não pode estar nos dois lados.`);
}

/** Aplica a troca (validando antes) e diz quais figurinhas cada lado colou pela primeira vez. */
export function aplicarTroca(
  invA: Inventario,
  invB: Inventario,
  oferta: readonly ItemTroca[],
  pedido: readonly ItemTroca[],
  catalogo: CatalogoPorRaridade,
): { invA: Inventario; invB: Inventario; novasA: string[]; novasB: string[] } {
  validarTroca(invA, invB, oferta, pedido, catalogo);
  const a: Record<string, number> = { ...invA };
  const b: Record<string, number> = { ...invB };
  const novasA: string[] = [];
  const novasB: string[] = [];
  for (const { codigo, quantidade } of oferta) {
    a[codigo] -= quantidade;
    if (!b[codigo]) novasB.push(codigo);
    b[codigo] = (b[codigo] ?? 0) + quantidade;
  }
  for (const { codigo, quantidade } of pedido) {
    b[codigo] -= quantidade;
    if (!a[codigo]) novasA.push(codigo);
    a[codigo] = (a[codigo] ?? 0) + quantidade;
  }
  return { invA: a, invB: b, novasA, novasB };
}

const PESO: Record<Raridade, number> = { LENDARIA: 0, EPICA: 1, RARA: 2, COMUM: 3 };

/**
 * Mercado de repetidas entre dois jogadores: o que A pode receber de B (B tem
 * repetida e A não tem) e o que A pode dar a B. Mais raras primeiro.
 */
export function sugerirTrocas(
  invA: Inventario,
  invB: Inventario,
  catalogo: CatalogoPorRaridade,
): { aRecebe: string[]; aDa: string[] } {
  const ordenar = (codigos: string[]) =>
    codigos.sort((x, y) => PESO[raridadeDe(catalogo, x)!] - PESO[raridadeDe(catalogo, y)!] || x.localeCompare(y));
  const todos = RARIDADES.flatMap((r) => catalogo[r].map((f) => f.codigo));
  return {
    aRecebe: ordenar(todos.filter((c) => !invA[c] && repetidas(invB, c) > 0)),
    aDa: ordenar(todos.filter((c) => !invB[c] && repetidas(invA, c) > 0)),
  };
}
