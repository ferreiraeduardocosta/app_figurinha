import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
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
import { RecompensaNova, entregarRecompensas } from './recompensas';
import { rngSeguro } from './rng-seguro';

export interface ResultadoAbertura {
  figurinhas: (FigurinhaSorteada & { nova: boolean })[];
  /** Recompensas conquistadas com este pacote (página ou álbum completo). */
  recompensas: RecompensaNova[];
}

type Tx = Prisma.TransactionClient;

/**
 * Abre pacotes e opera o balcão. Todo sorteio acontece aqui, no servidor, dentro de
 * uma transação com a linha do jogador travada (SELECT ... FOR UPDATE), para que
 * dois pedidos simultâneos não abram dois pacotes diários nem gastem as mesmas repetidas.
 */
@Injectable()
export class PacotesService implements OnModuleInit {
  private catalogoCarregado: CatalogoPorRaridade | null = null;
  private readonly log = new Logger('Pacotes');
  /** Gerador do sorteio. Só os testes trocam por um gerador com semente. */
  rng: Rng = rngSeguro;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.recarregarCatalogo();
  }

  /** Catálogo em memória, agrupado por raridade (usado também pelas trocas). */
  get catalogoAtual(): CatalogoPorRaridade {
    return this.catalogo;
  }

  /** Catálogo pronto para sorteio; sem figurinhas cadastradas, responde 503 em vez de derrubar a API. */
  private get catalogo(): CatalogoPorRaridade {
    if (!this.catalogoCarregado) {
      throw new ServiceUnavailableException({
        codigo: 'CATALOGO_VAZIO',
        mensagem: 'O álbum ainda não foi carregado no servidor. Tente de novo em instantes.',
      });
    }
    return this.catalogoCarregado;
  }

  /** Relê o catálogo do banco (o painel de admin chama isto depois de mudar figurinhas). */
  async recarregarCatalogo() {
    const lista = await this.prisma.figurinha.findMany({ select: { codigo: true, raridade: true } });
    try {
      this.catalogoCarregado = indexarCatalogo(lista, CONFIG_ECONOMIA);
    } catch (e) {
      // Banco novo (antes do seed) ou catálogo incompleto: a API sobe mesmo assim.
      if (!(e instanceof ErroRegra)) throw e;
      this.catalogoCarregado = null;
      this.log.warn(`Catálogo indisponível para sorteio: ${e.message} Rode o seed (npm run db:seed).`);
    }
  }

  /** Perfil do jogador: moedas, pacote diário e progresso no álbum. */
  async perfil(usuarioId: string, agora = new Date()) {
    const u = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      include: { recompensas: { select: { tipo: true, chave: true, criadaEm: true }, orderBy: { criadaEm: 'asc' } } },
    });
    const coladas = await this.prisma.itemAlbum.count({ where: { usuarioId, quantidade: { gt: 0 } } });
    const abertoHoje = !!u.ultimoPacoteDiarioEm && diaLocal(u.ultimoPacoteDiarioEm) === diaLocal(agora);
    return {
      id: u.id,
      apelido: u.apelido,
      email: u.email,
      moedas: u.moedas,
      pacoteDiario: { disponivel: !abertoHoje, proximoEm: abertoHoje ? proximaMeiaNoite(agora) : null },
      garantia: {
        pacotesParaEpica: CONFIG_ECONOMIA.garantia.epicaACadaPacotes - u.pacotesSemEpica,
        pacotesParaLendaria: CONFIG_ECONOMIA.garantia.lendariaACadaPacotes - u.pacotesSemLendaria,
      },
      album: { coladas, total: await this.prisma.figurinha.count() },
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
      select: { figurinhaCodigo: true, quantidade: true, brilhantes: true, figurinha: { select: { raridade: true } } },
      orderBy: { figurinha: { numero: 'asc' } },
    });
    const repetidas = { COMUM: 0, RARA: 0, EPICA: 0, LENDARIA: 0 };
    for (const i of itens) repetidas[i.figurinha.raridade] += i.quantidade - 1;
    return {
      itens: itens.map((i) => ({ codigo: i.figurinhaCodigo, quantidade: i.quantidade, brilhantes: i.brilhantes })),
      repetidas,
      balcao: CONFIG_ECONOMIA.balcao,
    };
  }

  async abrirPacoteDiario(usuarioId: string, agora = new Date()): Promise<ResultadoAbertura> {
    return this.prisma.$transaction(async (tx) => {
      const usuario = await this.travarUsuario(tx, usuarioId);
      if (usuario.ultimoPacoteDiarioEm && diaLocal(usuario.ultimoPacoteDiarioEm) === diaLocal(agora)) {
        throw new ConflictException({
          codigo: 'PACOTE_DIARIO_JA_ABERTO',
          mensagem: 'O pacote grátis de hoje já foi aberto. Volte amanhã!',
          proximoEm: proximaMeiaNoite(agora),
        });
      }
      await tx.usuario.update({ where: { id: usuarioId }, data: { ultimoPacoteDiarioEm: agora } });
      return this.abrir(tx, usuario, 'DIARIO', agora);
    });
  }

  /** Abre um pacote ganho como recompensa (página completa). */
  abrirPacoteBonus(usuarioId: string): Promise<ResultadoAbertura> {
    return this.abrirDeSaldo(usuarioId, 'pacotesBonus', 'RECOMPENSA', 'SEM_PACOTE_BONUS', 'Você não tem pacotes de recompensa.');
  }

  /** Abre um pacote comprado na loja. */
  abrirPacoteComprado(usuarioId: string): Promise<ResultadoAbertura> {
    return this.abrirDeSaldo(usuarioId, 'pacotesComprados', 'COMPRA', 'SEM_PACOTE_COMPRADO', 'Você não tem pacotes comprados.');
  }

  /** Compra e abre um pacote pagando com moedas do jogo. */
  async abrirPacoteComMoedas(usuarioId: string): Promise<ResultadoAbertura> {
    const preco = CONFIG_LOJA.pacoteComMoedas.preco;
    return this.prisma.$transaction(async (tx) => {
      const usuario = await this.travarUsuario(tx, usuarioId);
      if (usuario.moedas < preco) {
        throw new ConflictException({
          codigo: 'MOEDAS_INSUFICIENTES',
          mensagem: `O pacote custa ${preco} moedas e você tem ${usuario.moedas}.`,
        });
      }
      await tx.usuario.update({ where: { id: usuarioId }, data: { moedas: { decrement: preco } } });
      return this.abrir(tx, usuario, 'MOEDAS');
    });
  }

  private async abrirDeSaldo(
    usuarioId: string,
    campo: 'pacotesBonus' | 'pacotesComprados',
    origem: OrigemPacote,
    codigoErro: string,
    mensagem: string,
  ): Promise<ResultadoAbertura> {
    return this.prisma.$transaction(async (tx) => {
      const usuario = await this.travarUsuario(tx, usuarioId);
      if (usuario[campo] < 1) throw new ConflictException({ codigo: codigoErro, mensagem });
      await tx.usuario.update({ where: { id: usuarioId }, data: { [campo]: { decrement: 1 } } });
      return this.abrir(tx, usuario, origem);
    });
  }

  /** Sorteia, cola no álbum, atualiza a garantia, registra a abertura e entrega recompensas. */
  private async abrir(tx: Tx, usuario: Usuario, origem: OrigemPacote, agora = new Date()): Promise<ResultadoAbertura> {
    const usuarioId = usuario.id;
    const resultado = abrirPacote(
      this.catalogo,
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
      data: { usuarioId, origem, resultado: resultado.figurinhas as unknown as Prisma.InputJsonValue },
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
      const itens = await tx.itemAlbum.findMany({ where: { usuarioId } });
      const inventario: Inventario = Object.fromEntries(itens.map((i) => [i.figurinhaCodigo, i.quantidade]));

      let troca: ReturnType<typeof trocarNoBalcao>;
      try {
        troca = trocarNoBalcao(inventario, this.catalogo, CONFIG_ECONOMIA, codigoDesejado);
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
