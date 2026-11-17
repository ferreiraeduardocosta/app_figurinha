import { describe, expect, it } from 'vitest';
import economia from '../../../data/temporada1/economia.json';
import figurinhas from '../../../data/temporada1/figurinhas.json';
import { ConfigEconomia, ErroRegra, Raridade, aplicarTroca, indexarCatalogo, sugerirTrocas, validarTroca } from '../src';

const catalogo = indexarCatalogo(
  figurinhas.map((f) => ({ codigo: f.codigo, raridade: f.raridade as Raridade })),
  economia as unknown as ConfigEconomia,
);

const codigoErro = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as ErroRegra).codigo;
  }
  return null;
};

describe('trocas', () => {
  const ana = { 'UNI-05': 3, 'TUB-05': 1, 'LEN-01': 2 };
  const bia = { 'SER-05': 2, 'UNI-05': 1, 'POL-04': 4 };

  it('aplica a troca e aponta as figurinhas novas de cada lado', () => {
    const r = aplicarTroca(ana, bia, [{ codigo: 'LEN-01', quantidade: 1 }], [{ codigo: 'SER-05', quantidade: 1 }], catalogo);
    expect(r.invA).toMatchObject({ 'LEN-01': 1, 'SER-05': 1 });
    expect(r.invB).toMatchObject({ 'LEN-01': 1, 'SER-05': 1 });
    expect(r.novasA).toEqual(['SER-05']);
    expect(r.novasB).toEqual(['LEN-01']);
    expect(ana['LEN-01']).toBe(2); // não altera os originais
  });

  it('só troca repetidas: nunca a última cópia', () => {
    expect(codigoErro(() => validarTroca(ana, bia, [{ codigo: 'TUB-05', quantidade: 1 }], [{ codigo: 'SER-05', quantidade: 1 }], catalogo)))
      .toBe('SEM_REPETIDA');
    expect(codigoErro(() => validarTroca(ana, bia, [{ codigo: 'UNI-05', quantidade: 3 }], [{ codigo: 'SER-05', quantidade: 1 }], catalogo)))
      .toBe('SEM_REPETIDA');
    expect(codigoErro(() => validarTroca(ana, bia, [{ codigo: 'LEN-01', quantidade: 1 }], [{ codigo: 'UNI-05', quantidade: 1 }], catalogo)))
      .toBe('SEM_REPETIDA');
  });

  it('recusa proposta vazia, grande demais, com código repetido ou inexistente', () => {
    const lend = [{ codigo: 'LEN-01', quantidade: 1 }];
    expect(codigoErro(() => validarTroca(ana, bia, [], lend, catalogo))).toBe('TROCA_INVALIDA');
    expect(codigoErro(() => validarTroca(ana, { 'POL-04': 9 }, lend, [{ codigo: 'POL-04', quantidade: 6 }], catalogo))).toBe('TROCA_INVALIDA');
    expect(codigoErro(() => validarTroca(ana, bia, [...lend, ...lend], [{ codigo: 'SER-05', quantidade: 1 }], catalogo))).toBe('TROCA_INVALIDA');
    expect(codigoErro(() => validarTroca(ana, bia, [{ codigo: 'XXX-01', quantidade: 1 }], lend, catalogo))).toBe('FIGURINHA_INEXISTENTE');
    expect(codigoErro(() => validarTroca(ana, bia, [{ codigo: 'UNI-05', quantidade: 0 }], [{ codigo: 'SER-05', quantidade: 1 }], catalogo)))
      .toBe('TROCA_INVALIDA');
  });

  it('sugere o que cada um pode receber e dar, mais raras primeiro', () => {
    const s = sugerirTrocas(ana, bia, catalogo);
    expect(s.aRecebe).toEqual(['POL-04', 'SER-05']); // POL-04 (Ivar Solberg) é Épica, SER-05 (Muralha) é Rara
    expect(s.aDa).toEqual(['LEN-01']); // UNI-05: Bia já tem
  });
});
