import { ErroRegra } from './erros';
import { CatalogoPorRaridade } from './sorteio';
import { ConfigEconomia, FigurinhaSorteada, Inventario, Raridade } from './tipos';

/** Soma as cópias sorteadas ao inventário e diz quais figurinhas eram novas. */
export function aplicarPacote(
  inventario: Inventario,
  figurinhas: readonly FigurinhaSorteada[],
): { inventario: Inventario; novas: string[] } {
  const novo: Record<string, number> = { ...inventario };
  const novas: string[] = [];
  for (const f of figurinhas) {
    if (!novo[f.codigo]) novas.push(f.codigo);
    novo[f.codigo] = (novo[f.codigo] ?? 0) + 1;
  }
  return { inventario: novo, novas };
}

/** Quantas repetidas (cópias além da primeira) o jogador tem de uma raridade. */
export function contarRepetidas(inventario: Inventario, catalogo: CatalogoPorRaridade, raridade: Raridade): number {
  return catalogo[raridade].reduce((s, f) => s + Math.max(0, (inventario[f.codigo] ?? 0) - 1), 0);
}

/**
 * Balcão de repetidas: troca N repetidas da mesma raridade por uma figurinha que
 * falta, à escolha do jogador. Consome primeiro as figurinhas com mais cópias e
 * nunca tira a última cópia de nenhuma.
 */
export function trocarNoBalcao(
  inventario: Inventario,
  catalogo: CatalogoPorRaridade,
  config: ConfigEconomia,
  codigoDesejado: string,
): { inventario: Inventario; consumidas: Record<string, number> } {
  const raridade = (Object.keys(catalogo) as Raridade[]).find((r) =>
    catalogo[r].some((f) => f.codigo === codigoDesejado),
  );
  if (!raridade) {
    throw new ErroRegra('FIGURINHA_INEXISTENTE', `Figurinha ${codigoDesejado} não existe no álbum.`);
  }
  if ((inventario[codigoDesejado] ?? 0) > 0) {
    throw new ErroRegra('JA_POSSUI', `O jogador já tem a figurinha ${codigoDesejado}.`);
  }
  const custo = config.balcao.repetidasPorNova;
  const disponiveis = contarRepetidas(inventario, catalogo, raridade);
  if (disponiveis < custo) {
    throw new ErroRegra(
      'REPETIDAS_INSUFICIENTES',
      `São precisas ${custo} repetidas da raridade ${raridade}; o jogador tem ${disponiveis}.`,
    );
  }

  const novo: Record<string, number> = { ...inventario };
  const consumidas: Record<string, number> = {};
  for (let i = 0; i < custo; i++) {
    const alvo = catalogo[raridade]
      .map((f) => f.codigo)
      .filter((c) => (novo[c] ?? 0) > 1)
      .sort((a, b) => novo[b] - novo[a] || a.localeCompare(b))[0];
    novo[alvo] -= 1;
    consumidas[alvo] = (consumidas[alvo] ?? 0) + 1;
  }
  novo[codigoDesejado] = 1;
  return { inventario: novo, consumidas };
}
