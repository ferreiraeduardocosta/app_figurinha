import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { LigaService } from '../liga/liga.service';
import { PrismaService } from '../prisma/prisma.service';

const UNIDADES = { minutos: 1, horas: 60, dias: 24 * 60 } as const;
export type UnidadeIntervalo = keyof typeof UNIDADES;

/**
 * Ferramentas da fase de testes no painel: reiniciar a liga e zerar jogadores.
 * São destrutivas; o painel pede uma palavra de confirmação antes de chamar.
 */
@Injectable()
export class TestesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LigaService) private readonly liga: LigaService,
  ) {}

  async situacao() {
    const [liga, contas, admins, comFigurinhas] = await Promise.all([
      this.liga.situacao(),
      this.prisma.usuario.count({ where: { excluidoEm: null } }),
      this.prisma.usuario.count({ where: { papel: 'ADMIN' } }),
      this.prisma.usuario.count({ where: { album: { some: { quantidade: { gt: 0 } } } } }),
    ]);
    return { liga, jogadores: { contas, admins, comFigurinhas } };
  }

  /** dataHora no formato AAAA-MM-DDTHH:MM, no horário de Brasília. */
  reiniciarLiga(dataHora: unknown, intervalo: unknown, unidade: unknown) {
    if (typeof dataHora !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dataHora)) {
      throw new BadRequestException({ codigo: 'ENTRADA_INVALIDA', campo: 'primeiraRodada', mensagem: 'Informe data e hora da primeira rodada.' });
    }
    const inicio = new Date(`${dataHora}:00-03:00`);
    if (Number.isNaN(inicio.getTime())) {
      throw new BadRequestException({ codigo: 'ENTRADA_INVALIDA', campo: 'primeiraRodada', mensagem: 'Data inválida.' });
    }
    if (typeof unidade !== 'string' || !(unidade in UNIDADES)) {
      throw new BadRequestException({ codigo: 'ENTRADA_INVALIDA', campo: 'unidade', mensagem: 'Unidade deve ser minutos, horas ou dias.' });
    }
    const minutos = Number(intervalo) * UNIDADES[unidade as UnidadeIntervalo];
    if (!Number.isInteger(Number(intervalo)) || Number(intervalo) < 1 || minutos < 5 || minutos > 30 * 24 * 60) {
      throw new BadRequestException({
        codigo: 'ENTRADA_INVALIDA',
        campo: 'intervalo',
        mensagem: 'O intervalo entre rodadas deve ser um número inteiro, de 5 minutos a 30 dias.',
      });
    }
    return this.liga.reiniciar(inicio, minutos);
  }

  /**
   * Volta todos os jogadores (inclusive administradores) ao estado de conta nova:
   * sem figurinhas, moedas, pacotes, missões, recompensas, trocas nem bafos.
   * Mantém contas, senhas, sessões e amizades. Compras de teste somem; compras reais
   * ficam registradas (mas os pacotes delas também são zerados).
   */
  async zerarProgresso(confirmacao: unknown) {
    this.exigir(confirmacao, 'ZERAR');
    return this.prisma.$transaction(async (tx) => {
      const r = {
        figurinhas: (await tx.itemAlbum.deleteMany({})).count,
        pacotesAbertos: (await tx.aberturaPacote.deleteMany({})).count,
        recompensas: (await tx.recompensa.deleteMany({})).count,
        missoes: (await tx.missaoDia.deleteMany({})).count,
        trocas: (await tx.troca.deleteMany({})).count,
        bafos: (await tx.bafo.deleteMany({})).count,
        cuponsResgatados: (await tx.cupomResgate.deleteMany({})).count,
        comprasDeTeste: (await tx.compra.deleteMany({ where: { loja: 'TESTE' } })).count,
      };
      const jogadores = await tx.usuario.updateMany({
        data: {
          moedas: 0,
          pacotesBonus: 0,
          pacotesComprados: 0,
          pacotesSemEpica: 0,
          pacotesSemLendaria: 0,
          ultimoPacoteDiarioEm: null,
        },
      });
      return { jogadores: jogadores.count, ...r };
    });
  }

  private exigir(confirmacao: unknown, palavra: string) {
    if (confirmacao !== palavra) {
      throw new BadRequestException({ codigo: 'CONFIRMACAO', mensagem: `Digite ${palavra} para confirmar.` });
    }
  }
}
