import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OrigemPacote, Prisma, Usuario } from '@prisma/client';
import {
  CatalogoPorRaridade,
  ErroRegra,
  FigurinhaSorteada,
  Inventario,
  Rng,
  abrirPacote,
  indexarCatalogo,
  trocarNoBalcao,
} from '@craques-da-varzea/regras';
import { PrismaService } from '../prisma/prisma.service';
import { diaLocal, proximaMeiaNoite } from './dia';
import { CONFIG_LOJA } from '../loja/loja.service';
import { CONFIG_ECONOMIA } from './economia';
import { registrarProgresso } from '../missoes/missoes';
import { RecompensaNova, chaveAlbum, entregarRecompensas } from './recompensas';
import { rngSeguro } from './rng-seguro';

export interface ResultadoAbertura {
  figurinhas: (FigurinhaSorteada & { nova: boolean })[];
  /** Recompensas conquistadas com este pacote (página ou álbum completo). */
  recompensas: RecompensaNova[];
}

type Tx = Prisma.TransactionClient;

export interface InfoTemporada {
  numero: number;
  nome: string;
  /** Temporada cujo álbum completo libera esta (null = liberada para todos). */
  requisito: number | null;
  publicada: boolean;
}

/**
 * Abre pacotes e opera o balcão. Todo sorteio acontece aqui, no servidor, dentro de
 * uma transação com a linha do jogador travada (SELECT ... FOR UPDATE), para que
 * dois pedidos simultâneos não abram dois pacotes diários nem gastem as mesmas repetidas.
 */
@Injectable()
export class PacotesService implements OnModuleInit {
  /** Catálogo de sorteio de cada temporada (só as completas: todas as raridades com figurinhas). */
  private catalogos = new Map<number, CatalogoPorRaridade>();
  /** Todas as figurinhas de todas as temporadas, por raridade (para validar códigos em trocas). */
  private catalogoGeral: CatalogoPorRaridade | null = null;
  private temporadaPorCodigo = new Map<string, number>();
  private listaTemporadas: InfoTemporada[] = [];
  private readonly log = new Logger('Pacotes');
  /** Gerador do sorteio. Só os testes trocam por um gerador com semente. */
  rng: Rng = rngSeguro;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.recarregarCatalogo();
  }

  /** Todas as figurinhas (de todas as temporadas) agrupadas por raridade. */
  get catalogoAtual(): CatalogoPorRaridade {
    if (!this.catalogoGeral) throw this.semCatalogo();
    return this.catalogoGeral;
  }

  /** Catálogo pronto para sorteio de uma temporada. */
  catalogoDa(temporada: number): CatalogoPorRaridade {
    const c = this.catalogos.get(temporada);
    if (!c) throw this.semCatalogo();
    return c;
  }

  temporadaDaFigurinha(codigo: string): number | undefined {
    return this.temporadaPorCodigo.get(codigo);
  }

  /** Temporadas publicadas (visíveis no app), em ordem. */
  get temporadas(): InfoTemporada[] {
    return this.listaTemporadas.filter((t) => t.publicada);
  }

  private semCatalogo() {
    return new ServiceUnavailableException({
      codigo: 'CATALOGO_VAZIO',
      mensagem: 'O álbum ainda não foi carregado no servidor. Tente de novo em instantes.',
    });
  }

  /** Relê temporadas e catálogos do banco (o painel chama isto depois de mudar figurinhas). */
  async recarregarCatalogo() {
    const [temporadas, lista] = await Promise.all([
      this.prisma.temporada.findMany({ orderBy: { numero: 'asc' } }),
      this.prisma.figurinha.findMany({ select: { codigo: true, raridade: true, temporada: true } }),
    ]);
    this.listaTemporadas = temporadas.map((t) => ({ numero: t.numero, nome: t.nome, requisito: t.requisito, publicada: t.publicada }));
    this.temporadaPorCodigo = new Map(lista.map((f) => [f.codigo, f.temporada]));
    this.catalogos = new Map();
    for (const t of temporadas) {
      try {
        this.catalogos.set(t.numero, indexarCatalogo(lista.filter((f) => f.temporada === t.numero), CONFIG_ECONOMIA));
      } catch (e) {
        // Temporada ainda sem figurinhas (ou incompleta): a API sobe mesmo assim.
        if (!(e instanceof ErroRegra)) throw e;
        this.log.warn(`Temporada ${t.numero} indisponível para sorteio: ${e.message}`);
      }
    }
    try {
      this.catalogoGeral = indexarCatalogo(lista, CONFIG_ECONOMIA);
    } catch (e) {
      if (!(e instanceof ErroRegra)) throw e;
      this.catalogoGeral = null;
      this.log.warn(`Catálogo indisponível: ${e.message} Rode o seed (npm run db:seed).`);
    }
  }

  /** Temporadas que o jogador pode jogar: publicadas e com o álbum exigido completo. */
  async temporadasLiberadas(usuarioId: string, tx: Tx | PrismaService = this.prisma): Promise<number[]> {
    const albuns = new Set(
      (await tx.recompensa.findMany({ where: { usuarioId, tipo: 'ALBUM' }, select: { chave: true } })).map((r) => r.chave),
    );
    return this.temporadas.filter((t) => t.requisito === null || albuns.has(chaveAlbum(t.requisito))).map((t) => t.numero);
  }

  /** Erro se a temporada não existe, não está publicada ou ainda está bloqueada para o jogador. */
  async exigirLiberada(usuarioId: string, temporada: number, tx: Tx | PrismaService = this.prisma) {
    const t = this.temporadas.find((x) => x.numero === temporada);
    if (!t) throw new NotFoundException({ codigo: 'TEMPORADA_INEXISTENTE', mensagem: `Temporada ${temporada} não existe.` });
    if (!(await this.temporadasLiberadas(usuarioId, tx)).includes(temporada)) {
      const req = this.listaTemporadas.find((x) => x.numero === t.requisito);
      throw new ForbiddenException({
        codigo: 'TEMPORADA_BLOQUEADA',
        mensagem: `Complete o álbum da ${req?.nome ?? `Temporada ${t.requisito}`} para liberar a ${t.nome}.`,
      });
    }
  }

  /** Perfil do jogador: moedas, pacote diário e progresso no álbum. */
  async perfil(usuarioId: string, agora = new Date()) {
    const u = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      include: { recompensas: { select: { tipo: true, chave: true, criadaEm: true }, orderBy: { criadaEm: 'asc' } } },
    });
    const [porTemporada, totais, diarios, liberadas] = await Promise.all([
      this.prisma.$queryRaw<{ temporada: number; n: bigint }[]>`
        SELECT f."temporada" AS temporada, COUNT(*) AS n
        FROM "ItemAlbum" i JOIN "Figurinha" f ON f."codigo" = i."figurinhaCodigo"
        WHERE i."usuarioId" = ${usuarioId} AND i."quantidade" > 0
        GROUP BY f."temporada"`,
      this.prisma.figurinha.groupBy({ by: ['temporada'], _count: true }),
      this.prisma.pacoteDiario.findMany({ where: { usuarioId } }),
      this.temporadasLiberadas(usuarioId),
    ]);
    const coladasDa = (t: number) => Number(porTemporada.find((x) => x.temporada === t)?.n ?? 0);
    const totalDa = (t: number) => totais.find((x) => x.temporada === t)?._count ?? 0;
    const diario = (t: number) => {
      const d = diarios.find((x) => x.temporada === t);
      const abertoHoje = !!d && diaLocal(d.abertoEm) === diaLocal(agora);
      return { disponivel: !abertoHoje, proximoEm: abertoHoje ? proximaMeiaNoite(agora) : null };
    };
    const temporadas = this.temporadas.map((t) => ({
      numero: t.numero,
      nome: t.nome,
      requisito: t.requisito,
      liberada: liberadas.includes(t.numero),
      album: { coladas: coladasDa(t.numero), total: totalDa(t.numero) },
      pacoteDiario: liberadas.includes(t.numero) ? diario(t.numero) : { disponivel: false, proximoEm: null },
    }));
    return {
      id: u.id,
      apelido: u.apelido,
      email: u.email,
      moedas: u.moedas,
      // pacoteDiario e album são da Temporada 1 (compatibilidade com versões antigas do app).
      pacoteDiario: diario(1),
      temporadas,
      garantia: {
        pacotesParaEpica: CONFIG_ECONOMIA.garantia.epicaACadaPacotes - u.pacotesSemEpica,
        pacotesParaLendaria: CONFIG_ECONOMIA.garantia.lendariaACadaPacotes - u.pacotesSemLendaria,
      },
      album: { coladas: coladasDa(1), total: totalDa(1) },
      pacotesBonus: u.pacotesBonus,
      pacotesComprados: u.pacotesComprados,
      nascimentoInformado: !!u.dataNascimento,
      recompensas: u.recompensas,
      // Para o selo de "novidades" na aba de trocas.
      pendencias: {
        missoesParaResgatar: Number(
          (
            await this.prisma.$queryRaw<{ n: bigint }[]>`
              SELECT COUNT(*) AS n FROM "MissaoDia"
              WHERE "usuarioId" = ${usuarioId} AND "dia" = ${diaLocal(agora)} AND "progresso" >= "meta" AND "resgatadaEm" IS NULL`
          )[0]?.n ?? 0,
        ),
        pedidosAmizade: await this.prisma.amizade.count({ where: { destinatarioId: usuarioId, status: 'PENDENTE' } }),
        trocasRecebidas: await this.prisma.troca.count({
          where: { paraId: usuarioId, status: 'PENDENTE', expiraEm: { gt: agora } },
        }),
        // Desafios de bafo para responder + partidas com amigos esperando a minha batida.
        bafo: Number(
          (
            await this.prisma.$queryRaw<{ n: bigint }[]>`
              SELECT COUNT(*) AS n FROM "Bafo"
              WHERE "expiraEm" > ${agora} AND (
                ("status" = 'CONVITE' AND "adversarioId" = ${usuarioId})
                OR ("status" = 'JOGANDO' AND NOT "contraComputador" AND (
                  ("desafianteId" = ${usuarioId} AND "estado"->>'vez' = 'A')
                  OR ("adversarioId" = ${usuarioId} AND "estado"->>'vez' = 'B')
                ))
              )`
          )[0]?.n ?? 0,
        ),
      },
    };
  }

  /** Itens do álbum do jogador e repetidas disponíveis por raridade (para o balcão). */
  async album(usuarioId: string) {
    const itens = await this.prisma.itemAlbum.findMany({
      where: { usuarioId, quantidade: { gt: 0 } },
      select: { figurinhaCodigo: true, quantidade: true, brilhantes: true, figurinha: { select: { raridade: true, temporada: true } } },
      orderBy: [{ figurinha: { temporada: 'asc' } }, { figurinha: { numero: 'asc' } }],
    });
    const vazio = () => ({ COMUM: 0, RARA: 0, EPICA: 0, LENDARIA: 0 });
    const repetidasPorTemporada: Record<number, ReturnType<typeof vazio>> = {};
    for (const i of itens) (repetidasPorTemporada[i.figurinha.temporada] ??= vazio())[i.figurinha.raridade] += i.quantidade - 1;
    return {
      itens: itens.map((i) => ({ codigo: i.figurinhaCodigo, quantidade: i.quantidade, brilhantes: i.brilhantes, temporada: i.figurinha.temporada })),
      // repetidas = Temporada 1 (compatibilidade); por temporada em repetidasPorTemporada.
      repetidas: repetidasPorTemporada[1] ?? vazio(),
      repetidasPorTemporada,
      balcao: CONFIG_ECONOMIA.balcao,
    };
  }

  async abrirPacoteDiario(usuarioId: string, temporada = 1, agora = new Date()): Promise<ResultadoAbertura> {
    return this.prisma.$transaction(async (tx) => {
      const usuario = await this.travarUsuario(tx, usuarioId);
      await this.exigirLiberada(usuarioId, temporada, tx);
      const ultimo = await tx.pacoteDiario.findUnique({ where: { usuarioId_temporada: { usuarioId, temporada } } });
      if (ultimo && diaLocal(ultimo.abertoEm) === diaLocal(agora)) {
        throw new ConflictException({
          codigo: 'PACOTE_DIARIO_JA_ABERTO',
          mensagem: 'O pacote grátis de hoje já foi aberto. Volte amanhã!',
          proximoEm: proximaMeiaNoite(agora),
        });
      }
      await tx.pacoteDiario.upsert({
        where: { usuarioId_temporada: { usuarioId, temporada } },
        create: { usuarioId, temporada, abertoEm: agora },
        update: { abertoEm: agora },
      });
      return this.abrir(tx, usuario, 'DIARIO', temporada, agora);
    });
  }

  /** Abre um pacote ganho como recompensa (página completa). */
  abrirPacoteBonus(usuarioId: string, temporada = 1): Promise<ResultadoAbertura> {
    return this.abrirDeSaldo(usuarioId, temporada, 'pacotesBonus', 'RECOMPENSA', 'SEM_PACOTE_BONUS', 'Você não tem pacotes de recompensa.');
  }

  /** Abre um pacote comprado na loja. */
  abrirPacoteComprado(usuarioId: string, temporada = 1): Promise<ResultadoAbertura> {
    return this.abrirDeSaldo(usuarioId, temporada, 'pacotesComprados', 'COMPRA', 'SEM_PACOTE_COMPRADO', 'Você não tem pacotes comprados.');
  }

  /** Compra e abre um pacote pagando com moedas do jogo. */
  async abrirPacoteComMoedas(usuarioId: string, temporada = 1): Promise<ResultadoAbertura> {
    const preco = CONFIG_LOJA.pacoteComMoedas.preco;
    return this.prisma.$transaction(async (tx) => {
      const usuario = await this.travarUsuario(tx, usuarioId);
      await this.exigirLiberada(usuarioId, temporada, tx);
      if (usuario.moedas < preco) {
        throw new ConflictException({
          codigo: 'MOEDAS_INSUFICIENTES',
          mensagem: `O pacote custa ${preco} moedas e você tem ${usuario.moedas}.`,
        });
      }
      await tx.usuario.update({ where: { id: usuarioId }, data: { moedas: { decrement: preco } } });
      return this.abrir(tx, usuario, 'MOEDAS', temporada);
    });
  }

  private async abrirDeSaldo(
    usuarioId: string,
    temporada: number,
    campo: 'pacotesBonus' | 'pacotesComprados',
    origem: OrigemPacote,
    codigoErro: string,
    mensagem: string,
  ): Promise<ResultadoAbertura> {
    return this.prisma.$transaction(async (tx) => {
      const usuario = await this.travarUsuario(tx, usuarioId);
      await this.exigirLiberada(usuarioId, temporada, tx);
      if (usuario[campo] < 1) throw new ConflictException({ codigo: codigoErro, mensagem });
      await tx.usuario.update({ where: { id: usuarioId }, data: { [campo]: { decrement: 1 } } });
      return this.abrir(tx, usuario, origem, temporada);
    });
  }

  /** Sorteia, cola no álbum, atualiza a garantia, registra a abertura e entrega recompensas. */
  private async abrir(tx: Tx, usuario: Usuario, origem: OrigemPacote, temporada: number, agora = new Date()): Promise<ResultadoAbertura> {
    const usuarioId = usuario.id;
    const resultado = abrirPacote(
      this.catalogoDa(temporada),
      CONFIG_ECONOMIA,
      { pacotesSemEpica: usuario.pacotesSemEpica, pacotesSemLendaria: usuario.pacotesSemLendaria },
      this.rng,
    );

    const jaTinha = new Set(
      (
        await tx.itemAlbum.findMany({
          where: { usuarioId, figurinhaCodigo: { in: resultado.figurinhas.map((f) => f.codigo) } },
          select: { figurinhaCodigo: true },
        })
      ).map((i) => i.figurinhaCodigo),
    );

    const porCodigo = new Map<string, { quantidade: number; brilhantes: number }>();
    for (const f of resultado.figurinhas) {
      const atual = porCodigo.get(f.codigo) ?? { quantidade: 0, brilhantes: 0 };
      atual.quantidade += 1;
      if (f.brilhante) atual.brilhantes += 1;
      porCodigo.set(f.codigo, atual);
    }
    for (const [codigo, { quantidade, brilhantes }] of porCodigo) {
      await tx.itemAlbum.upsert({
        where: { usuarioId_figurinhaCodigo: { usuarioId, figurinhaCodigo: codigo } },
        create: { usuarioId, figurinhaCodigo: codigo, quantidade, brilhantes },
        update: { quantidade: { increment: quantidade }, brilhantes: { increment: brilhantes } },
      });
    }

    await tx.usuario.update({ where: { id: usuarioId }, data: resultado.estado });
    await tx.aberturaPacote.create({
      data: { usuarioId, origem, temporada, resultado: resultado.figurinhas as unknown as Prisma.InputJsonValue },
    });
    const recompensas = await entregarRecompensas(tx, usuarioId);

    // Missões do dia.
    const novas = new Set(resultado.figurinhas.map((f) => f.codigo).filter((c) => !jaTinha.has(c))).size;
    await registrarProgresso(tx, usuarioId, 'ABRIR_PACOTES', 1, agora);
    await registrarProgresso(tx, usuarioId, 'COLAR_NOVAS', novas, agora);
    if (resultado.figurinhas.some((f) => f.raridade !== 'COMUM')) {
      await registrarProgresso(tx, usuarioId, 'TIRAR_RARA', 1, agora);
    }

    const vistas = new Set<string>();
    return {
      figurinhas: resultado.figurinhas.map((f) => {
        const nova = !jaTinha.has(f.codigo) && !vistas.has(f.codigo);
        vistas.add(f.codigo);
        return { ...f, nova };
      }),
      recompensas,
    };
  }

  async trocarNoBalcao(usuarioId: string, codigoDesejado: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.travarUsuario(tx, usuarioId);
      // O balcão troca repetidas da mesma temporada da figurinha pedida.
      const temporada = this.temporadaDaFigurinha(codigoDesejado) ?? 1;
      await this.exigirLiberada(usuarioId, temporada, tx);
      const itens = await tx.itemAlbum.findMany({ where: { usuarioId, figurinha: { temporada } } });
      const inventario: Inventario = Object.fromEntries(itens.map((i) => [i.figurinhaCodigo, i.quantidade]));

      let troca: ReturnType<typeof trocarNoBalcao>;
      try {
        troca = trocarNoBalcao(inventario, this.catalogoDa(temporada), CONFIG_ECONOMIA, codigoDesejado);
      } catch (e) {
        if (e instanceof ErroRegra) {
          throw new UnprocessableEntityException({ codigo: e.codigo, mensagem: e.message });
        }
        throw e;
      }

      for (const [codigo, qtd] of Object.entries(troca.consumidas)) {
        await tx.itemAlbum.update({
          where: { usuarioId_figurinhaCodigo: { usuarioId, figurinhaCodigo: codigo } },
          data: { quantidade: { decrement: qtd } },
        });
      }
      await tx.itemAlbum.create({ data: { usuarioId, figurinhaCodigo: codigoDesejado, quantidade: 1 } });
      const recompensas = await entregarRecompensas(tx, usuarioId);
      await registrarProgresso(tx, usuarioId, 'USAR_BALCAO', 1);
      await registrarProgresso(tx, usuarioId, 'COLAR_NOVAS', 1);
      return { recebida: codigoDesejado, consumidas: troca.consumidas, recompensas };
    });
  }

  private async travarUsuario(tx: Tx, usuarioId: string) {
    await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR UPDATE`;
    return tx.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  }
}
