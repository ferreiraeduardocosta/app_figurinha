import { ConflictException, Injectable, OnModuleInit, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
import { CONFIG_ECONOMIA } from './economia';
import { rngSeguro } from './rng-seguro';

/** O "dia" do pacote grátis vira à meia-noite de Brasília. */
const FUSO = 'America/Sao_Paulo';
const diaLocal = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(d);

export interface ResultadoAbertura {
  figurinhas: (FigurinhaSorteada & { nova: boolean })[];
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

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const lista = await this.prisma.figurinha.findMany({ select: { codigo: true, raridade: true } });
    this.catalogo = indexarCatalogo(lista, CONFIG_ECONOMIA);
  }

  async abrirPacoteDiario(usuarioId: string, agora = new Date()): Promise<ResultadoAbertura> {
    return this.prisma.$transaction(async (tx) => {
      const usuario = await this.travarUsuario(tx, usuarioId);
      if (usuario.ultimoPacoteDiarioEm && diaLocal(usuario.ultimoPacoteDiarioEm) === diaLocal(agora)) {
        throw new ConflictException({
          codigo: 'PACOTE_DIARIO_JA_ABERTO',
          mensagem: 'O pacote grátis de hoje já foi aberto. Volte amanhã!',
        });
      }

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

      await tx.usuario.update({
        where: { id: usuarioId },
        data: { ...resultado.estado, ultimoPacoteDiarioEm: agora },
      });
      await tx.aberturaPacote.create({
        data: { usuarioId, origem: 'DIARIO', resultado: resultado.figurinhas as unknown as Prisma.InputJsonValue },
      });

      const vistas = new Set<string>();
      return {
        figurinhas: resultado.figurinhas.map((f) => {
          const nova = !jaTinha.has(f.codigo) && !vistas.has(f.codigo);
          vistas.add(f.codigo);
          return { ...f, nova };
        }),
      };
    });
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
      return { recebida: codigoDesejado, consumidas: troca.consumidas };
    });
  }

  private async travarUsuario(tx: Tx, usuarioId: string) {
    await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR UPDATE`;
    return tx.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  }
}
