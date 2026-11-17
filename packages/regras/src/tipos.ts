export const RARIDADES = ['COMUM', 'RARA', 'EPICA', 'LENDARIA'] as const;
export type Raridade = (typeof RARIDADES)[number];

/** Uma figurinha do catálogo, com o mínimo que as regras precisam saber. */
export interface FigurinhaCatalogo {
  codigo: string;
  raridade: Raridade;
}

/** Parâmetros da economia (mesmo formato de data/temporada1/economia.json). */
export interface ConfigEconomia {
  figurinhasPorPacote: number;
  probabilidades: Record<Raridade, number>;
  garantia: {
    /** Após este número de pacotes sem Épica ou Lendária, o próximo traz uma Épica. */
    epicaACadaPacotes: number;
    /** Após este número de pacotes sem Lendária, o próximo traz uma Lendária. */
    lendariaACadaPacotes: number;
  };
  balcao: {
    /** Repetidas da mesma raridade trocadas por 1 figurinha que falta. */
    repetidasPorNova: number;
  };
  brilhante: {
    chancePorFigurinha: number;
  };
}

/** Contadores da garantia mínima, guardados por jogador no servidor. */
export interface EstadoGarantia {
  pacotesSemEpica: number;
  pacotesSemLendaria: number;
}

export interface FigurinhaSorteada {
  codigo: string;
  raridade: Raridade;
  brilhante: boolean;
  /** true quando a raridade veio da garantia mínima, não do sorteio. */
  garantida: boolean;
}

export interface ResultadoPacote {
  figurinhas: FigurinhaSorteada[];
  estado: EstadoGarantia;
}

/** Quantidade de cada figurinha que o jogador tem (a primeira cópia + repetidas). */
export type Inventario = Readonly<Record<string, number>>;

/** Gerador de números aleatórios em [0, 1). No servidor, use um gerador criptográfico. */
export type Rng = () => number;
