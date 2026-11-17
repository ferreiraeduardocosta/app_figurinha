import { ConflictException, Inject, Injectable, OnModuleInit, UnprocessableEntityException } from '@nestjs/common';
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
} from '@liga-aurora/regras';
import { PrismaService } from '../prisma/prisma.service';
import { diaLocal, proximaMeiaNoite } from './dia';
import { CONFIG_ECONOMIA } from './economia';
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
  private catalogo!: CatalogoPorRaridade;
  /** Gerador do sorteio. Só os testes trocam por um gerador com semente. */
  rng: Rng = rngSeguro;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.recarregarCatalogo();
  }

  /** Relê o catálogo do banco (o painel de admin chama isto depois de mudar figurinhas). */
  async recarregarCatalogo() {
    const lista = await this.prisma.figurinha.findMany({ select: { codigo: true, raridade: true } });
    this.catalogo = indexarCatalogo(lista, CONFIG_ECONOMIA);
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
      recompensas: u.recompensas,
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
      return this.abrir(tx, usuario, 'DIARIO');
    });
  }

  /** Abre um pacote ganho como recompensa (página completa). */
  async abrirPacoteBonus(usuarioId: string): Promise<ResultadoAbertura> {
    return this.prisma.$transaction(async (tx) => {
      const usuario = await this.travarUsuario(tx, usuarioId);
      if (usuario.pacotesBonus < 1) {
        throw new ConflictException({ codigo: 'SEM_PACOTE_BONUS', mensagem: 'Você não tem pacotes de recompensa.' });
      }
      await tx.usuario.update({ where: { id: usuarioId }, data: { pacotesBonus: { decrement: 1 } } });
      return this.abrir(tx, usuario, 'RECOMPENSA');
    });
  }

  /** Sorteia, cola no álbum, atualiza a garantia, registra a abertura e entrega recompensas. */
  private async abrir(tx: Tx, usuario: Usuario, origem: OrigemPacote): Promise<ResultadoAbertura> {
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
      return { recebida: codigoDesejado, consumidas: troca.consumidas, recompensas };
    });
  }

  private async travarUsuario(tx: Tx, usuarioId: string) {
    await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR UPDATE`;
    return tx.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  }
}
