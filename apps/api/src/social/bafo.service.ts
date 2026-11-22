import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Bafo, Prisma } from '@prisma/client';
import {
  BAFO,
  ErroRegra,
  EstadoBafo,
  LadoBafo,
  Rng,
  bater,
  montarMonte,
  precisaoDoComputador,
  resultadoBafo,
} from '@craques-da-varzea/regras';
import { registrarProgresso } from '../missoes/missoes';
import { diaLocal } from '../pacotes/dia';
import { PacotesService } from '../pacotes/pacotes.service';
import { RecompensaNova, entregarRecompensas } from '../pacotes/recompensas';
import { rngSeguro } from '../pacotes/rng-seguro';
import { PrismaService } from '../prisma/prisma.service';
import { AmigosService } from './amigos.service';
import { Tx, travarUsuarios } from './comum';

const HORA = 60 * 60 * 1000;
/** Prazos: para aceitar o desafio, para jogar a vez (amigos) e para terminar contra o computador. */
export const PRAZOS_BAFO = { conviteMs: 24 * HORA, vezMs: 24 * HORA, computadorMs: 2 * HORA };
const ABERTOS = ['CONVITE', 'JOGANDO'] as const;
const incluir = {
  desafiante: { select: { id: true, apelido: true } },
  adversario: { select: { id: true, apelido: true } },
} as const;
type BafoCompleto = Prisma.BafoGetPayload<{ include: typeof incluir }>;

@Injectable()
export class BafoService {
  rng: Rng = rngSeguro;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PacotesService) private readonly pacotes: PacotesService,
    @Inject(AmigosService) private readonly amigos: AmigosService,
  ) {}

  async listar(eu: string, agora = new Date()) {
    await this.expirarVencidos(agora);
    const meus = { OR: [{ desafianteId: eu }, { adversarioId: eu }] };
    const [abertos, recentes, jogadasHoje, jogadasComputadorHoje] = await Promise.all([
      this.prisma.bafo.findMany({ where: { ...meus, status: { in: [...ABERTOS] } }, include: incluir, orderBy: { atualizadoEm: 'desc' } }),
      this.prisma.bafo.findMany({
        where: { ...meus, status: { notIn: [...ABERTOS] } },
        include: incluir,
        orderBy: { atualizadoEm: 'desc' },
        take: 10,
      }),
      this.jogadasHoje(this.prisma, eu, agora),
      this.jogadasComputadorHoje(this.prisma, eu, agora),
    ]);
    const lista = (l: BafoCompleto[]) => l.map((b) => this.apresentar(b, eu));
    return {
      // Só contra o computador há limite; entre amigos é livre.
      limiteComputador: BAFO.partidasPorDiaComputador,
      jogadasComputadorHoje,
      // Campos das versões antigas do app (que bloqueavam tudo ao atingir limiteDia):
      // um número alto mantém os desafios entre amigos liberados nelas.
      limiteDia: 9999,
      jogadasHoje,
      convitesRecebidos: lista(abertos.filter((b) => b.status === 'CONVITE' && b.adversarioId === eu)),
      convitesEnviados: lista(abertos.filter((b) => b.status === 'CONVITE' && b.desafianteId === eu)),
      emAndamento: lista(abertos.filter((b) => b.status === 'JOGANDO')),
      recentes: lista(recentes),
    };
  }

  async ver(eu: string, id: string, agora = new Date()) {
    await this.expirarVencidos(agora);
    return this.apresentar(await this.buscar(this.prisma, id, eu), eu);
  }

  /** Partida contra o computador: ele põe figurinhas da mesma raridade das suas. */
  async contraComputador(eu: string, figurinhas: string[], agora = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      await travarUsuarios(tx, [eu]);
      await this.exigirLimiteComputador(tx, eu, agora);
      const temporada = await this.temporadaDoMonte(tx, [eu], figurinhas);
      await this.reservar(tx, eu, figurinhas);
      const cartasB = figurinhas.map((c) => this.sortearMesmaRaridade(c, temporada));
      const estado = this.regra(() => montarMonte(figurinhas, cartasB, this.rng));
      const b = await tx.bafo.create({
        data: {
          desafianteId: eu,
          contraComputador: true,
          status: 'JOGANDO',
          quantidade: figurinhas.length,
          cartasA: figurinhas,
          estado: estado as unknown as Prisma.InputJsonValue,
          dia: diaLocal(agora),
          expiraEm: new Date(agora.getTime() + PRAZOS_BAFO.computadorMs),
        },
        include: incluir,
      });
      return this.apresentar(b, eu);
    });
  }

  /** Desafia um amigo. As figurinhas do desafiante ficam reservadas até a resposta. */
  async desafiar(eu: string, adversarioId: string, figurinhas: string[], agora = new Date()) {
    if (adversarioId === eu) throw new UnprocessableEntityException({ codigo: 'BAFO_INVALIDO', mensagem: 'Você não pode jogar contra si mesmo.' });
    return this.prisma.$transaction(async (tx) => {
      await travarUsuarios(tx, [eu, adversarioId]);
      if (!(await this.amigos.saoAmigos(tx, eu, adversarioId))) {
        throw new ForbiddenException({ codigo: 'SO_ENTRE_AMIGOS', mensagem: 'Só dá para desafiar amigos.' });
      }
      const pendentes = await tx.bafo.count({ where: { desafianteId: eu, status: 'CONVITE' } });
      if (pendentes >= 5) {
        throw new ConflictException({ codigo: 'LIMITE_DESAFIOS', mensagem: 'Você já tem 5 desafios esperando resposta.' });
      }
      this.validarQuantidade(figurinhas);
      await this.temporadaDoMonte(tx, [eu, adversarioId], figurinhas);
      await this.reservar(tx, eu, figurinhas);
      const b = await tx.bafo.create({
        data: {
          desafianteId: eu,
          adversarioId,
          status: 'CONVITE',
          quantidade: figurinhas.length,
          cartasA: figurinhas,
          expiraEm: new Date(agora.getTime() + PRAZOS_BAFO.conviteMs),
        },
        include: incluir,
      });
      return this.apresentar(b, eu);
    });
  }

  /** Aceita o desafio pondo a mesma quantidade de repetidas. A partida começa na vez de quem desafiou. */
  async aceitar(eu: string, id: string, figurinhas: string[], agora = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const b0 = await this.buscar(tx, id, eu);
      await travarUsuarios(tx, [b0.desafianteId, eu]);
      const b = await this.travarPartida(tx, id);
      if (b.adversarioId !== eu) throw new ForbiddenException({ codigo: 'NAO_PERMITIDO', mensagem: 'Só quem foi desafiado pode aceitar.' });
      this.exigirStatus(b, 'CONVITE', agora);
      if (figurinhas.length !== b.quantidade) {
        throw new UnprocessableEntityException({
          codigo: 'BAFO_INVALIDO',
          mensagem: `Este desafio vale ${b.quantidade} figurinha(s) de cada lado.`,
        });
      }
      // As figurinhas de quem aceita têm de ser da mesma temporada das do desafio.
      await this.temporadaDoMonte(tx, [eu], [...(b.cartasA as string[]), ...figurinhas]);
      await this.reservar(tx, eu, figurinhas);
      const estado = this.regra(() => montarMonte(b.cartasA as string[], figurinhas, this.rng));
      const atualizado = await tx.bafo.update({
        where: { id },
        data: {
          status: 'JOGANDO',
          estado: estado as unknown as Prisma.InputJsonValue,
          dia: diaLocal(agora),
          expiraEm: new Date(agora.getTime() + PRAZOS_BAFO.vezMs),
        },
        include: incluir,
      });
      return this.apresentar(atualizado, eu);
    });
  }

  async recusar(eu: string, id: string, agora = new Date()) {
    return this.encerrarConvite(eu, id, 'adversario', 'RECUSADA', agora);
  }

  async cancelar(eu: string, id: string, agora = new Date()) {
    return this.encerrarConvite(eu, id, 'desafiante', 'CANCELADA', agora);
  }

  /**
   * Uma batida. A precisão (0 a 1) vem da barra de força do app. Contra o
   * computador, ele joga em seguida as vezes dele.
   */
  async bater(eu: string, id: string, precisao: number, agora = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const b0 = await this.buscar(tx, id, eu);
      await travarUsuarios(tx, [b0.desafianteId, ...(b0.adversarioId ? [b0.adversarioId] : [])]);
      const b = await this.travarPartida(tx, id);
      this.exigirStatus(b, 'JOGANDO', agora);
      const lado: LadoBafo = b.desafianteId === eu ? 'A' : 'B';
      let estado = b.estado as unknown as EstadoBafo;
      estado = this.regra(() => bater(estado, lado, precisao, this.rng));
      if (b.contraComputador) {
        while (!estado.terminou && estado.vez === 'B') estado = bater(estado, 'B', precisaoDoComputador(this.rng), this.rng);
      }
      let recompensas: RecompensaNova[] = [];
      let novas: string[] = [];
      if (estado.terminou) {
        ({ recompensas, novas } = await finalizar(tx, b, estado, 'FINALIZADA', eu, agora));
      } else {
        await tx.bafo.update({
          where: { id },
          data: {
            estado: estado as unknown as Prisma.InputJsonValue,
            expiraEm: b.contraComputador ? b.expiraEm : new Date(agora.getTime() + PRAZOS_BAFO.vezMs),
          },
        });
      }
      const atualizado = await tx.bafo.findUniqueOrThrow({ where: { id }, include: incluir });
      return { ...this.apresentar(atualizado, eu), novas, recompensas };
    });
  }

  // ---------------------------------------------------------------------------

  /** Tira as figurinhas do álbum para o monte. Só repetidas: a última cópia nunca entra. */
  private async reservar(tx: Tx, usuarioId: string, codigos: string[]) {
    this.validarQuantidade(codigos);
    const precisa = contar(codigos);
    const itens = await tx.itemAlbum.findMany({ where: { usuarioId, figurinhaCodigo: { in: Object.keys(precisa) } } });
    const tem = Object.fromEntries(itens.map((i) => [i.figurinhaCodigo, i.quantidade]));
    for (const [codigo, n] of Object.entries(precisa)) {
      if (!Object.values(this.pacotes.catalogoAtual).some((lista) => lista.some((f) => f.codigo === codigo))) {
        throw new UnprocessableEntityException({ codigo: 'FIGURINHA_INEXISTENTE', mensagem: `Figurinha ${codigo} não existe.` });
      }
      if ((tem[codigo] ?? 0) - 1 < n) {
        throw new UnprocessableEntityException({
          codigo: 'SEM_REPETIDA',
          mensagem: `Você não tem ${n} repetida(s) de ${codigo}. No bafo só entram repetidas.`,
        });
      }
    }
    for (const [codigo, n] of Object.entries(precisa)) {
      await tx.itemAlbum.update({
        where: { usuarioId_figurinhaCodigo: { usuarioId, figurinhaCodigo: codigo } },
        data: { quantidade: { decrement: n } },
      });
    }
    await tx.$executeRaw`UPDATE "ItemAlbum" SET "brilhantes" = LEAST("brilhantes", "quantidade") WHERE "usuarioId" = ${usuarioId}`;
  }

  private async encerrarConvite(eu: string, id: string, papel: 'desafiante' | 'adversario', status: 'RECUSADA' | 'CANCELADA', agora: Date) {
    return this.prisma.$transaction(async (tx) => {
      const b0 = await this.buscar(tx, id, eu);
      await travarUsuarios(tx, [b0.desafianteId]);
      const b = await this.travarPartida(tx, id);
      if ((papel === 'desafiante' ? b.desafianteId : b.adversarioId) !== eu) {
        throw new ForbiddenException({
          codigo: 'NAO_PERMITIDO',
          mensagem: papel === 'desafiante' ? 'Só quem desafiou pode cancelar.' : 'Só quem foi desafiado pode recusar.',
        });
      }
      this.exigirStatus(b, 'CONVITE', agora);
      await creditar(tx, b.desafianteId, b.cartasA as string[], agora);
      const atualizado = await tx.bafo.update({ where: { id }, data: { status }, include: incluir });
      return this.apresentar(atualizado, eu);
    });
  }

  /** Convites sem resposta devolvem as figurinhas; partidas paradas terminam como estão. */
  private async expirarVencidos(agora: Date) {
    const vencidos = await this.prisma.bafo.findMany({
      where: { status: { in: [...ABERTOS] }, expiraEm: { lte: agora } },
      select: { id: true, desafianteId: true, adversarioId: true },
      take: 50,
    });
    for (const v of vencidos) {
      await this.prisma.$transaction(async (tx) => {
        await travarUsuarios(tx, [v.desafianteId, ...(v.adversarioId ? [v.adversarioId] : [])]);
        const b = await this.travarPartida(tx, v.id);
        if (!ABERTOS.includes(b.status as (typeof ABERTOS)[number]) || b.expiraEm > agora) return;
        if (b.status === 'CONVITE') {
          await creditar(tx, b.desafianteId, b.cartasA as string[], agora);
          await tx.bafo.update({ where: { id: b.id }, data: { status: 'EXPIRADA' } });
        } else {
          await finalizar(tx, b, b.estado as unknown as EstadoBafo, 'EXPIRADA', '', agora);
        }
      });
    }
  }

  private async jogadasHoje(tx: Tx | PrismaService, usuarioId: string, agora: Date) {
    return tx.bafo.count({
      where: { dia: diaLocal(agora), OR: [{ desafianteId: usuarioId }, { adversarioId: usuarioId }] },
    });
  }

  private async jogadasComputadorHoje(tx: Tx | PrismaService, usuarioId: string, agora: Date) {
    return tx.bafo.count({ where: { dia: diaLocal(agora), desafianteId: usuarioId, contraComputador: true } });
  }

  private async exigirLimiteComputador(tx: Tx, usuarioId: string, agora: Date) {
    if ((await this.jogadasComputadorHoje(tx, usuarioId, agora)) >= BAFO.partidasPorDiaComputador) {
      throw new ConflictException({
        codigo: 'LIMITE_BAFO_DIA',
        mensagem: `Limite de ${BAFO.partidasPorDiaComputador} partidas contra o computador por dia atingido. Volte amanhã, ou desafie um amigo: entre amigos não tem limite!`,
      });
    }
  }

  private validarQuantidade(codigos: string[]) {
    if (codigos.length < 1 || codigos.length > BAFO.maxCartasPorLado) {
      throw new UnprocessableEntityException({ codigo: 'BAFO_INVALIDO', mensagem: `Ponha de 1 a ${BAFO.maxCartasPorLado} figurinhas no monte.` });
    }
  }

  /** Todas as figurinhas do monte são da mesma temporada, liberada para quem joga. */
  private async temporadaDoMonte(tx: Tx, jogadores: string[], codigos: string[]) {
    const temporadas = new Set(codigos.map((c) => this.pacotes.temporadaDaFigurinha(c)));
    if (temporadas.has(undefined)) {
      throw new UnprocessableEntityException({ codigo: 'FIGURINHA_INEXISTENTE', mensagem: 'Figurinha inexistente no monte.' });
    }
    if (temporadas.size > 1) {
      throw new UnprocessableEntityException({ codigo: 'BAFO_INVALIDO', mensagem: 'No bafo, todas as figurinhas são da mesma temporada.' });
    }
    const [temporada] = [...temporadas] as number[];
    for (const j of jogadores) await this.pacotes.exigirLiberada(j, temporada, tx);
    return temporada;
  }

  private sortearMesmaRaridade(codigo: string, temporada: number): string {
    const cat = this.pacotes.catalogoDa(temporada);
    const raridade = (Object.keys(cat) as (keyof typeof cat)[]).find((r) => cat[r].some((f) => f.codigo === codigo));
    const lista = cat[raridade ?? 'COMUM'];
    return lista[Math.floor(this.rng() * lista.length)].codigo;
  }

  private async buscar(tx: Tx | PrismaService, id: string, eu: string): Promise<BafoCompleto> {
    const b = await tx.bafo.findUnique({ where: { id }, include: incluir });
    if (!b || (b.desafianteId !== eu && b.adversarioId !== eu)) {
      throw new NotFoundException({ codigo: 'BAFO_INEXISTENTE', mensagem: 'Partida de bafo não encontrada.' });
    }
    return b;
  }

  private async travarPartida(tx: Tx, id: string): Promise<Bafo> {
    await tx.$queryRaw`SELECT id FROM "Bafo" WHERE id = ${id} FOR UPDATE`;
    return tx.bafo.findUniqueOrThrow({ where: { id } });
  }

  private exigirStatus(b: Bafo, status: 'CONVITE' | 'JOGANDO', agora: Date) {
    if (b.status === status && b.expiraEm <= agora) {
      throw new ConflictException({ codigo: 'BAFO_EXPIRADO', mensagem: 'O prazo desta partida acabou.' });
    }
    if (b.status !== status) {
      throw new ConflictException({
        codigo: 'BAFO_ENCERRADO',
        mensagem: status === 'CONVITE' ? 'Este desafio já foi respondido.' : 'Esta partida não está em andamento.',
      });
    }
  }

  private regra<T>(fn: () => T): T {
    try {
      return fn();
    } catch (e) {
      if (e instanceof ErroRegra) throw new UnprocessableEntityException({ codigo: e.codigo, mensagem: e.message });
      throw e;
    }
  }

  /** Visão da partida para um jogador: as cartas ainda para baixo não mostram qual figurinha são. */
  private apresentar(b: BafoCompleto, eu: string) {
    const souA = b.desafianteId === eu;
    const meuLado: LadoBafo = souA ? 'A' : 'B';
    const outro: LadoBafo = souA ? 'B' : 'A';
    const estado = b.estado as unknown as EstadoBafo | null;
    const fim = !!estado?.terminou || !ABERTOS.includes(b.status as (typeof ABERTOS)[number]);
    const placar = { eu: 0, adversario: 0 };
    for (const c of estado?.monte ?? []) {
      if (c.virou === meuLado) placar.eu++;
      else if (c.virou === outro) placar.adversario++;
    }
    const resultado = estado && fim ? resultadoBafo(estado) : null;
    return {
      id: b.id,
      status: b.status,
      contraComputador: b.contraComputador,
      quantidade: b.quantidade,
      euDesafiei: souA,
      adversario: souA ? (b.adversario ?? { id: null, apelido: 'Computador' }) : b.desafiante,
      /** As figurinhas que o desafiante pôs (o desafiado vê antes de aceitar). */
      cartasDesafiante: b.cartasA as string[],
      monte: (estado?.monte ?? []).map((c) => ({
        minha: c.dono === meuLado,
        virou: c.virou === null ? null : c.virou === meuLado ? 'EU' : 'ADVERSARIO',
        codigo: c.virou || fim ? c.codigo : null,
      })),
      batidas: (estado?.batidas ?? []).map((x) => ({ minha: x.lado === meuLado, precisao: x.precisao, viradas: x.viradas })),
      minhaVez: b.status === 'JOGANDO' && !!estado && !estado.terminou && estado.vez === meuLado,
      placar,
      recebi: resultado ? resultado[meuLado].recebe : null,
      expiraEm: b.expiraEm,
      atualizadoEm: b.atualizadoEm,
    };
  }
}

function contar(codigos: string[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const c of codigos) r[c] = (r[c] ?? 0) + 1;
  return r;
}

/** Antes de excluir uma conta: devolve as figurinhas reservadas dos outros jogadores. */
export async function devolverBafosDaConta(tx: Tx, usuarioId: string, agora = new Date()) {
  const abertos = await tx.bafo.findMany({
    where: { status: { in: [...ABERTOS] }, OR: [{ desafianteId: usuarioId }, { adversarioId: usuarioId }] },
  });
  for (const b of abertos) {
    if (b.status === 'CONVITE') {
      if (b.desafianteId !== usuarioId) await creditar(tx, b.desafianteId, b.cartasA as string[], agora);
      await tx.bafo.update({ where: { id: b.id }, data: { status: 'CANCELADA' } });
    } else {
      await finalizar(tx, b, b.estado as unknown as EstadoBafo, 'CANCELADA', usuarioId, agora, usuarioId);
    }
  }
}

async function finalizar(
  tx: Tx,
  b: Bafo,
  estado: EstadoBafo,
  status: 'FINALIZADA' | 'EXPIRADA' | 'CANCELADA',
  eu: string,
  agora: Date,
  pular?: string,
) {
  const r = resultadoBafo(estado);
  const porLado: [string | null, string[]][] = [
    [b.desafianteId, r.A.recebe],
    [b.contraComputador ? null : b.adversarioId, r.B.recebe],
  ];
  let recompensas: RecompensaNova[] = [];
  let novas: string[] = [];
  for (const [usuarioId, cartas] of porLado) {
    if (!usuarioId || usuarioId === pular) continue;
    const c = await creditar(tx, usuarioId, cartas, agora);
    if (usuarioId === eu) ({ recompensas, novas } = c);
  }
  await tx.bafo.update({
    where: { id: b.id },
    data: { status, estado: { ...estado, terminou: true } as unknown as Prisma.InputJsonValue },
  });
  return { recompensas, novas };
}

/** Devolve/entrega figurinhas, entrega recompensas de página e conta as novas para as missões. */
async function creditar(tx: Tx, usuarioId: string, codigos: string[], agora: Date) {
  if (codigos.length === 0) return { recompensas: [] as RecompensaNova[], novas: [] as string[] };
  const novas: string[] = [];
  for (const [codigo, n] of Object.entries(contar(codigos))) {
    const atual = await tx.itemAlbum.findUnique({ where: { usuarioId_figurinhaCodigo: { usuarioId, figurinhaCodigo: codigo } } });
    if (!atual || atual.quantidade === 0) novas.push(codigo);
    await tx.itemAlbum.upsert({
      where: { usuarioId_figurinhaCodigo: { usuarioId, figurinhaCodigo: codigo } },
      create: { usuarioId, figurinhaCodigo: codigo, quantidade: n },
      update: { quantidade: { increment: n } },
    });
  }
  if (novas.length) await registrarProgresso(tx, usuarioId, 'COLAR_NOVAS', novas.length, agora);
  const recompensas = await entregarRecompensas(tx, usuarioId);
  return { recompensas, novas };
}
