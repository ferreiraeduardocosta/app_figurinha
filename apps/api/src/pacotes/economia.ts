import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigEconomia, validarConfig } from '@craques-da-varzea/regras';

/** Pasta com os dados da temporada (padrão: data/temporada1 na raiz do repositório). */
const DADOS_DIR = process.env.DADOS_DIR ?? resolve(__dirname, '../../../../data/temporada1');

export const CONFIG_ECONOMIA: ConfigEconomia = JSON.parse(readFileSync(resolve(DADOS_DIR, 'economia.json'), 'utf8'));
validarConfig(CONFIG_ECONOMIA);

export function probabilidadesPublicas() {
  const c = CONFIG_ECONOMIA;
  return {
    figurinhasPorPacote: c.figurinhasPorPacote,
    porFigurinha: c.probabilidades,
    garantia: c.garantia,
    brilhante: c.brilhante.chancePorFigurinha,
    balcao: c.balcao,
  };
}
