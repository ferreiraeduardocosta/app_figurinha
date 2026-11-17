import { describe, expect, it } from 'vitest';
import economia from '../../../data/temporada1/economia.json';
import figurinhas from '../../../data/temporada1/figurinhas.json';
import {
  ConfigEconomia,
  ESTADO_INICIAL,
  ErroRegra,
  EstadoGarantia,
  FigurinhaCatalogo,
  RARIDADES,
  Raridade,
  abrirPacote,
  aplicarPacote,
  contarRepetidas,
  indexarCatalogo,
  rngComSemente,
  trocarNoBalcao,
  validarConfig,
} from '../src';

const config = economia as unknown as ConfigEconomia;
const catalogoLista = figurinhas.map((f) => ({ codigo: f.codigo, raridade: f.raridade as Raridade }));
const catalogo = indexarCatalogo(catalogoLista, config);

const semGarantia: ConfigEconomia = {
  ...config,
  garantia: { epicaACadaPacotes: 1_000_000, lendariaACadaPacotes: 1_000_000 },
};

function abrirVarios(n: number, cfg: ConfigEconomia, rng: () => number) {
  let estado: EstadoGarantia = ESTADO_INICIAL;
  const pacotes = [];
  for (let i = 0; i < n; i++) {
    const r = abrirPacote(catalogo, cfg, estado, rng);
    estado = r.estado;
    pacotes.push(r.figurinhas);
  }
  return pacotes;
}

describe('dados da Temporada 1', () => {
  it('a economia é válida', () => {
    expect(() => validarConfig(config)).not.toThrow();
  });

  it('o álbum tem 136 figurinhas com a distribuição planejada', () => {
    expect(catalogoLista).toHaveLength(136);
    expect(catalogo.COMUM).toHaveLength(88);
    expect(catalogo.RARA).toHaveLength(24);
    expect(catalogo.EPICA).toHaveLength(16);
    expect(catalogo.LENDARIA).toHaveLength(8);
  });
});

describe('validarConfig', () => {
  it('recusa probabilidades que não somam 1', () => {
    const ruim = { ...config, probabilidades: { COMUM: 0.5, RARA: 0.2, EPICA: 0.1, LENDARIA: 0.1 } };
    expect(() => validarConfig(ruim)).toThrow(ErroRegra);
  });
});

describe('abrirPacote', () => {
  it('traz sempre o número certo de figurinhas, todas do catálogo', () => {
    const codigos = new Set(catalogoLista.map((f) => f.codigo));
    for (const pacote of abrirVarios(200, config, rngComSemente(1))) {
      expect(pacote).toHaveLength(config.figurinhasPorPacote);
      for (const f of pacote) expect(codigos.has(f.codigo)).toBe(true);
    }
  });

  it('segue as probabilidades configuradas (sem garantia)', () => {
    const contagem: Record<Raridade, number> = { COMUM: 0, RARA: 0, EPICA: 0, LENDARIA: 0 };
    let brilhantes = 0;
    const pacotes = abrirVarios(20_000, semGarantia, rngComSemente(2));
    for (const f of pacotes.flat()) {
      contagem[f.raridade]++;
      if (f.brilhante) brilhantes++;
    }
    const total = pacotes.length * config.figurinhasPorPacote;
    for (const r of RARIDADES) {
      expect(contagem[r] / total).toBeCloseTo(config.probabilidades[r], 2);
    }
    expect(brilhantes / total).toBeCloseTo(config.brilhante.chancePorFigurinha, 2);
  });

  it('sorteia com a mesma chance dentro de cada raridade', () => {
    const lendarias: Record<string, number> = {};
    for (const f of abrirVarios(40_000, semGarantia, rngComSemente(3)).flat()) {
      if (f.raridade === 'LENDARIA') lendarias[f.codigo] = (lendarias[f.codigo] ?? 0) + 1;
    }
    const valores = Object.values(lendarias);
    expect(valores).toHaveLength(8);
    expect(Math.min(...valores) / Math.max(...valores)).toBeGreaterThan(0.8);
  });

  it('garante uma Épica a cada 10 pacotes e uma Lendária a cada 30', () => {
    // rng sempre 0: o sorteio só daria Comuns, então tudo que vier acima disso é garantia.
    const sempreZero = () => 0;
    const pacotes = abrirVarios(60, config, sempreZero);
    pacotes.forEach((pacote, i) => {
      const numero = i + 1;
      const raridades = pacote.map((f) => f.raridade);
      if (numero % 30 === 0) {
        expect(raridades).toContain('LENDARIA');
        expect(pacote.filter((f) => f.garantida)).toHaveLength(1);
      } else if (numero % 10 === 0) {
        expect(raridades).toContain('EPICA');
      } else {
        expect(raridades.every((r) => r === 'COMUM')).toBe(true);
      }
    });
  });

  it('zera o contador quando a raridade vem naturalmente', () => {
    const r = abrirPacote(catalogo, config, { pacotesSemEpica: 5, pacotesSemLendaria: 12 }, () => 0.99);
    // 0.99 cai em Lendária pela tabela acumulada (62% + 25% + 10% = 97%).
    expect(r.figurinhas.every((f) => f.raridade === 'LENDARIA' && !f.garantida)).toBe(true);
    expect(r.estado).toEqual({ pacotesSemEpica: 0, pacotesSemLendaria: 0 });
  });
});

describe('balcão de repetidas', () => {
  const comuns = catalogo.COMUM.map((f: FigurinhaCatalogo) => f.codigo);

  it('aplicarPacote soma cópias e aponta as novas', () => {
    const { inventario, novas } = aplicarPacote({ [comuns[0]]: 1 }, [
      { codigo: comuns[0], raridade: 'COMUM', brilhante: false, garantida: false },
      { codigo: comuns[1], raridade: 'COMUM', brilhante: false, garantida: false },
    ]);
    expect(inventario[comuns[0]]).toBe(2);
    expect(inventario[comuns[1]]).toBe(1);
    expect(novas).toEqual([comuns[1]]);
  });

  it('troca 4 repetidas por 1 que falta, sem tirar a última cópia de nenhuma', () => {
    const inv = { [comuns[0]]: 4, [comuns[1]]: 2, [comuns[2]]: 1 };
    expect(contarRepetidas(inv, catalogo, 'COMUM')).toBe(4);
    const r = trocarNoBalcao(inv, catalogo, config, comuns[5]);
    expect(r.inventario[comuns[5]]).toBe(1);
    expect(r.inventario[comuns[0]]).toBe(1);
    expect(r.inventario[comuns[1]]).toBe(1);
    expect(r.inventario[comuns[2]]).toBe(1);
    expect(r.consumidas).toEqual({ [comuns[0]]: 3, [comuns[1]]: 1 });
    expect(inv[comuns[0]]).toBe(4); // não altera o inventário original
  });

  it('recusa quando faltam repetidas, quando já possui ou quando a figurinha não existe', () => {
    const inv = { [comuns[0]]: 4 };
    const erro = (fn: () => unknown) => {
      try {
        fn();
      } catch (e) {
        return (e as ErroRegra).codigo;
      }
      return null;
    };
    expect(erro(() => trocarNoBalcao(inv, catalogo, config, comuns[1]))).toBe('REPETIDAS_INSUFICIENTES');
    expect(erro(() => trocarNoBalcao(inv, catalogo, config, comuns[0]))).toBe('JA_POSSUI');
    expect(erro(() => trocarNoBalcao(inv, catalogo, config, 'XXX-99'))).toBe('FIGURINHA_INEXISTENTE');
    // repetidas de outra raridade não servem
    const rara = catalogo.RARA[0].codigo;
    expect(erro(() => trocarNoBalcao({ [rara]: 9 }, catalogo, config, comuns[1]))).toBe('REPETIDAS_INSUFICIENTES');
  });
});
