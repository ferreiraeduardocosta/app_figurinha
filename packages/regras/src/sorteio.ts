import { ErroRegra } from './erros';
import {
  ConfigEconomia,
  EstadoGarantia,
  FigurinhaCatalogo,
  FigurinhaSorteada,
  RARIDADES,
  Raridade,
  ResultadoPacote,
  Rng,
} from './tipos';

export type CatalogoPorRaridade = Readonly<Record<Raridade, readonly FigurinhaCatalogo[]>>;

export const ESTADO_INICIAL: EstadoGarantia = { pacotesSemEpica: 0, pacotesSemLendaria: 0 };

export function validarConfig(config: ConfigEconomia): void {
  const soma = RARIDADES.reduce((s, r) => s + config.probabilidades[r], 0);
  if (Math.abs(soma - 1) > 1e-9) {
    throw new ErroRegra('CONFIG_INVALIDA', `As probabilidades somam ${soma}, e precisam somar 1.`);
  }
  if (RARIDADES.some((r) => config.probabilidades[r] < 0)) {
    throw new ErroRegra('CONFIG_INVALIDA', 'Probabilidade negativa.');
  }
  const inteiros = [
    config.figurinhasPorPacote,
    config.garantia.epicaACadaPacotes,
    config.garantia.lendariaACadaPacotes,
    config.balcao.repetidasPorNova,
  ];
  if (inteiros.some((n) => !Number.isInteger(n) || n < 1)) {
    throw new ErroRegra('CONFIG_INVALIDA', 'Pacote, garantias e balcão precisam ser inteiros maiores que zero.');
  }
  const b = config.brilhante.chancePorFigurinha;
  if (b < 0 || b > 1) {
    throw new ErroRegra('CONFIG_INVALIDA', 'Chance de Brilhante fora de [0, 1].');
  }
}

/** Agrupa o catálogo por raridade e confere que toda raridade sorteável tem figurinhas. */
export function indexarCatalogo(catalogo: readonly FigurinhaCatalogo[], config: ConfigEconomia): CatalogoPorRaridade {
  const indice: Record<Raridade, FigurinhaCatalogo[]> = { COMUM: [], RARA: [], EPICA: [], LENDARIA: [] };
  const vistos = new Set<string>();
  for (const f of catalogo) {
    if (vistos.has(f.codigo)) {
      throw new ErroRegra('CATALOGO_INVALIDO', `Código repetido no catálogo: ${f.codigo}`);
    }
    vistos.add(f.codigo);
    indice[f.raridade].push(f);
  }
  for (const r of RARIDADES) {
    // Épica e Lendária precisam existir mesmo com chance zero, por causa da garantia mínima.
    const precisa = config.probabilidades[r] > 0 || r === 'EPICA' || r === 'LENDARIA';
    if (precisa && indice[r].length === 0) {
      throw new ErroRegra('CATALOGO_INVALIDO', `Não há figurinhas da raridade ${r}.`);
    }
  }
  return indice;
}

function sortearRaridade(probabilidades: Record<Raridade, number>, rng: Rng): Raridade {
  const x = rng();
  let acumulado = 0;
  for (const r of RARIDADES) {
    acumulado += probabilidades[r];
    if (x < acumulado) return r;
  }
  // Arredondamento de ponto flutuante: fica com a última raridade com chance.
  return [...RARIDADES].reverse().find((r) => probabilidades[r] > 0)!;
}

function escolher<T>(lista: readonly T[], rng: Rng): T {
  return lista[Math.floor(rng() * lista.length)];
}

/**
 * Abre um pacote. Função pura: quem chama guarda o novo estado da garantia.
 *
 * Garantia mínima: se este for o N-ésimo pacote seguido sem Lendária (ou sem
 * Épica/Lendária), a última figurinha do pacote é trocada pela raridade garantida.
 */
export function abrirPacote(
  catalogo: CatalogoPorRaridade,
  config: ConfigEconomia,
  estado: EstadoGarantia,
  rng: Rng,
): ResultadoPacote {
  const n = config.figurinhasPorPacote;
  const raridades = Array.from({ length: n }, () => sortearRaridade(config.probabilidades, rng));
  const garantidas = new Set<number>();

  const semLendaria = estado.pacotesSemLendaria + 1;
  const semEpica = estado.pacotesSemEpica + 1;

  if (!raridades.includes('LENDARIA') && semLendaria >= config.garantia.lendariaACadaPacotes) {
    raridades[n - 1] = 'LENDARIA';
    garantidas.add(n - 1);
  }
  const temEpicaOuMelhor = () => raridades.some((r) => r === 'EPICA' || r === 'LENDARIA');
  if (!temEpicaOuMelhor() && semEpica >= config.garantia.epicaACadaPacotes) {
    raridades[n - 1] = 'EPICA';
    garantidas.add(n - 1);
  }

  const figurinhas: FigurinhaSorteada[] = raridades.map((raridade, i) => ({
    codigo: escolher(catalogo[raridade], rng).codigo,
    raridade,
    brilhante: rng() < config.brilhante.chancePorFigurinha,
    garantida: garantidas.has(i),
  }));

  return {
    figurinhas,
    estado: {
      pacotesSemEpica: temEpicaOuMelhor() ? 0 : semEpica,
      pacotesSemLendaria: raridades.includes('LENDARIA') ? 0 : semLendaria,
    },
  };
}
