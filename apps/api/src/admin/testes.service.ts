import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { LigaService } from '../liga/liga.service';
import { PacotesService } from '../pacotes/pacotes.service';
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
    @Inject(PacotesService) private readonly pacotes: PacotesService,
  ) {}

  // ---------------- Temporadas ----------------

  async listarTemporadas() {
    const [temporadas, contagem] = await Promise.all([
      this.prisma.temporada.findMany({ orderBy: { numero: 'asc' } }),
      this.prisma.figurinha.groupBy({ by: ['temporada'], _count: true }),
    ]);
    return temporadas.map((t) => ({
      ...t,
      figurinhas: contagem.find((c) => c.temporada === t.numero)?._count ?? 0,
      // Pronta para sorteio: tem figurinhas de todas as raridades.
      pronta: (() => {
        try {
          this.pacotes.catalogoDa(t.numero);
          return true;
        } catch {
          return false;
        }
      })(),
    }));
  }

  /** Cria uma temporada nova, ainda não publicada (fica invisível no app enquanto é montada). */
  async criarTemporada(corpo: Record<string, unknown>) {
    const numero = Number(corpo.numero);
    const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';
    if (!Number.isInteger(numero) || numero < 2 || numero > 99) this.erro('numero', 'Número da temporada: de 2 a 99.');
    if (nome.length < 3 || nome.length > 40) this.erro('nome', 'Nome com 3 a 40 caracteres.');
    const requisito = await this.requisitoValido(corpo.requisito, numero);
    if (await this.prisma.temporada.findUnique({ where: { numero } })) {
      throw new ConflictException({ codigo: 'JA_EXISTE', mensagem: `A temporada ${numero} já existe.` });
    }
    await this.prisma.temporada.create({ data: { numero, nome, requisito, publicada: false } });
    await this.pacotes.recarregarCatalogo();
    return this.listarTemporadas();
  }

  /** Muda nome, requisito ou publicação. Só publica temporada com figurinhas de todas as raridades. */
  async editarTemporada(numero: number, corpo: Record<string, unknown>) {
    const atual = await this.prisma.temporada.findUnique({ where: { numero } });
    if (!atual) throw new NotFoundException({ codigo: 'TEMPORADA_INEXISTENTE', mensagem: `Temporada ${numero} não existe.` });
    const dados: { nome?: string; requisito?: number | null; publicada?: boolean } = {};
    if ('nome' in corpo) {
      const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';
      if (nome.length < 3 || nome.length > 40) this.erro('nome', 'Nome com 3 a 40 caracteres.');
      dados.nome = nome;
    }
    if ('requisito' in corpo) dados.requisito = await this.requisitoValido(corpo.requisito, numero);
    if ('publicada' in corpo) {
      if (typeof corpo.publicada !== 'boolean') this.erro('publicada', 'publicada deve ser verdadeiro ou falso.');
      if (numero === 1 && corpo.publicada === false) this.erro('publicada', 'A Temporada 1 não pode ser escondida.');
      if (corpo.publicada) {
        await this.pacotes.recarregarCatalogo();
        try {
          this.pacotes.catalogoDa(numero);
        } catch {
          throw new UnprocessableEntityException({
            codigo: 'TEMPORADA_INCOMPLETA',
            mensagem: 'Para publicar, a temporada precisa ter figurinhas de todas as raridades.',
          });
        }
      }
      dados.publicada = corpo.publicada as boolean;
    }
    await this.prisma.temporada.update({ where: { numero }, data: dados });
    await this.pacotes.recarregarCatalogo();
    return this.listarTemporadas();
  }

  private async requisitoValido(valor: unknown, numero: number): Promise<number | null> {
    if (valor === null || valor === undefined || valor === '') return null;
    const r = Number(valor);
    if (!Number.isInteger(r) || r < 1 || r >= numero) this.erro('requisito', 'O requisito deve ser uma temporada anterior.');
    if (!(await this.prisma.temporada.findUnique({ where: { numero: r } }))) this.erro('requisito', `Temporada ${r} não existe.`);
    return r;
  }

  private erro(campo: string, mensagem: string): never {
    throw new BadRequestException({ codigo: 'ENTRADA_INVALIDA', campo, mensagem });
  }

  async situacao() {
    const temporadas = await this.prisma.temporada.findMany({ orderBy: { numero: 'asc' } });
    const ligas = [];
    for (const t of temporadas) ligas.push({ nome: t.nome, ...(await this.liga.situacao(t.numero)) });
    const [contas, admins, comFigurinhas] = await Promise.all([
      this.prisma.usuario.count({ where: { excluidoEm: null } }),
      this.prisma.usuario.count({ where: { papel: 'ADMIN' } }),
      this.prisma.usuario.count({ where: { album: { some: { quantidade: { gt: 0 } } } } }),
    ]);
    return { ligas, liga: ligas[0], jogadores: { contas, admins, comFigurinhas } };
  }

  /** dataHora no formato AAAA-MM-DDTHH:MM, no horário de Brasília. */
  reiniciarLiga(dataHora: unknown, intervalo: unknown, unidade: unknown, temporada: unknown = 1) {
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
    const t = Number(temporada ?? 1);
    if (!Number.isInteger(t) || t < 1) {
      throw new BadRequestException({ codigo: 'ENTRADA_INVALIDA', campo: 'temporada', mensagem: 'Temporada inválida.' });
    }
    return this.liga.reiniciar(inicio, minutos, t);
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
        pacotesDiarios: (await tx.pacoteDiario.deleteMany({})).count,
        comprasDeTeste: (await tx.compra.deleteMany({ where: { loja: 'TESTE' } })).count,
      };
      const jogadores = await tx.usuario.updateMany({
        data: {
          moedas: 0,
          pacotesBonus: 0,
          pacotesComprados: 0,
          pacotesSemEpica: 0,
          pacotesSemLendaria: 0,
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
