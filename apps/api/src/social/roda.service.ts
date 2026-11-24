import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, RodaBafo, RodaParticipante } from '@prisma/client';
import { BAFO, ErroRegra, EstadoBafo, Rng, bater, montarRoda, pularVez, resultadoBafo } from '@craques-da-varzea/regras';
import { diaLocal } from '../pacotes/dia';
import { RecompensaNova } from '../pacotes/recompensas';
import { rngSeguro } from '../pacotes/rng-seguro';
import { PrismaService } from '../prisma/prisma.service';
import { AmigosService } from './amigos.service';
import { EventosService } from './eventos.service';
import { BafoService, PRAZOS_BAFO, creditar } from './bafo.service';
import { Tx, travarUsuarios } from './comum';

const ABERTAS = ['CONVITE', 'JOGANDO'] as const;
const incluir = {
  anfitriao: { select: { id: true, apelido: true } },
  participantes: { include: { usuario: { select: { id: true, apelido: true } } }, orderBy: { lado: 'asc' as const } },
} as const;
type RodaCompleta = Prisma.RodaBafoGetPayload<{ include: typeof incluir }>;

/**
 * Rodinha de bafo: o anfitrião convida de 2 a 5 amigos, cada um põe a mesma
 * quantidade de repetidas e todos batem em rodízio (ordem em cobrinha).
 * Começa sozinha quando todos responderem (com pelo menos 3 dentro) ou quando o
 * anfitrião mandar começar. Vez não jogada no prazo é pulada.
 */
@Injectable()
export class RodaService {
  rng: Rng = rngSeguro;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AmigosService) private readonly amigos: AmigosService,
    @Inject(BafoService) private readonly bafo: BafoService,
    @Inject(EventosService) private readonly eventos: EventosService,
  ) {}

  async listar(eu: string, agora = new Date()) {
    await this.expirarVencidas(agora);
    const minhas = await this.prisma.rodaBafo.findMany({
      where: { participantes: { some: { usuarioId: eu, status: { not: 'RECUSOU' } } } },
      include: incluir,
      orderBy: { atualizadoEm: 'desc' },
      take: 40,
    });
    const v = (r: RodaCompleta) => this.apresentar(r, eu);
    const meuStatus = (r: RodaCompleta) => r.participantes.find((p) => p.usuarioId === eu)?.status;
    return {
      convites: minhas.filter((r) => r.status === 'CONVITE' && meuStatus(r) === 'CONVIDADO').map(v),
      esperando: minhas.filter((r) => r.status === 'CONVITE' && meuStatus(r) === 'DENTRO').map(v),
      emAndamento: minhas.filter((r) => r.status === 'JOGANDO').map(v),
      recentes: minhas.filter((r) => !ABERTAS.includes(r.status as (typeof ABERTAS)[number])).slice(0, 10).map(v),
    };
  }

  async ver(eu: string, id: string, agora = new Date()) {
    await this.expirarVencidas(agora);
    return this.apresentar(await this.buscar(this.prisma, id, eu), eu);
  }

  async criar(eu: string, convidados: string[], figurinhas: string[], agora = new Date()) {
    const outros = [...new Set(convidados)].filter((id) => id !== eu);
    if (outros.length < BAFO.minRoda - 1 || outros.length > BAFO.maxRoda - 1) {
      throw new UnprocessableEntityException({
        codigo: 'BAFO_INVALIDO',
        mensagem: `Convide de ${BAFO.minRoda - 1} a ${BAFO.maxRoda - 1} amigos (a rodinha tem de ${BAFO.minRoda} a ${BAFO.maxRoda} jogadores).`,
      });
    }
    return this.prisma.$transaction(async (tx) => {
      await travarUsuarios(tx, [eu, ...outros]);
      for (const id of outros) {
        if (!(await this.amigos.saoAmigos(tx, eu, id))) {
          throw new ForbiddenException({ codigo: 'SO_ENTRE_AMIGOS', mensagem: 'Só dá para convidar amigos para a rodinha.' });
        }
      }
      const abertas = await tx.rodaBafo.count({ where: { anfitriaoId: eu, status: 'CONVITE' } });
      if (abertas >= 3) throw new ConflictException({ codigo: 'LIMITE_DESAFIOS', mensagem: 'Você já tem 3 rodinhas esperando resposta.' });
      const temporada = await this.bafo.temporadaDoMonte(tx, [eu], figurinhas);
      // Quem ainda não liberou a temporada não pode ser convidado para ela.
      for (const id of outros) {
        await this.bafo.temporadaDoMonte(tx, [id], figurinhas).catch(async () => {
          const u = await tx.usuario.findUnique({ where: { id }, select: { apelido: true } });
          throw new UnprocessableEntityException({
            codigo: 'TEMPORADA_BLOQUEADA',
            mensagem: `${u?.apelido ?? 'Um amigo'} ainda não liberou a temporada dessas figurinhas.`,
          });
        });
      }
      await this.bafo.reservar(tx, eu, figurinhas);
      const r = await tx.rodaBafo.create({
        data: {
          anfitriaoId: eu,
          status: 'CONVITE',
          quantidade: figurinhas.length,
          temporada,
          expiraEm: new Date(agora.getTime() + PRAZOS_BAFO.conviteMs),
          participantes: {
            create: [
              { usuarioId: eu, status: 'DENTRO', cartas: figurinhas, entrouEm: agora },
              ...outros.map((usuarioId) => ({ usuarioId, status: 'CONVIDADO' as const })),
            ],
          },
        },
        include: incluir,
      });
      return this.apresentar(r, eu);
    });
  }

  async entrar(eu: string, id: string, figurinhas: string[], agora = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const r = await this.travar(tx, id, eu);
      this.exigirConvite(r, agora);
      const p = r.participantes.find((x) => x.usuarioId === eu)!;
      if (p.status !== 'CONVIDADO') throw new ConflictException({ codigo: 'BAFO_ENCERRADO', mensagem: 'Você já respondeu este convite.' });
      if (figurinhas.length !== r.quantidade) {
        throw new UnprocessableEntityException({ codigo: 'BAFO_INVALIDO', mensagem: `Esta rodinha vale ${r.quantidade} figurinha(s) de cada um.` });
      }
      const doAnfitriao = (r.participantes.find((x) => x.usuarioId === r.anfitriaoId)?.cartas as string[]) ?? [];
      await this.bafo.temporadaDoMonte(tx, [eu], [...doAnfitriao, ...figurinhas]);
      await this.bafo.reservar(tx, eu, figurinhas);
      await tx.rodaParticipante.update({
        where: { rodaId_usuarioId: { rodaId: id, usuarioId: eu } },
        data: { status: 'DENTRO', cartas: figurinhas, entrouEm: agora },
      });
      await this.talvezComecar(tx, id, agora);
      return this.apresentar(await this.carregar(tx, id), eu);
    });
  }

  async recusar(eu: string, id: string, agora = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const r = await this.travar(tx, id, eu);
      this.exigirConvite(r, agora);
      const p = r.participantes.find((x) => x.usuarioId === eu)!;
      if (p.status !== 'CONVIDADO') throw new ConflictException({ codigo: 'BAFO_ENCERRADO', mensagem: 'Você já respondeu este convite.' });
      await tx.rodaParticipante.update({ where: { rodaId_usuarioId: { rodaId: id, usuarioId: eu } }, data: { status: 'RECUSOU' } });
      await this.talvezComecar(tx, id, agora);
      return this.apresentar(await this.carregar(tx, id), eu);
    });
  }

  /** O anfitrião começa com quem já entrou (pelo menos 3 jogadores). */
  async comecar(eu: string, id: string, agora = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const r = await this.travar(tx, id, eu);
      if (r.anfitriaoId !== eu) throw new ForbiddenException({ codigo: 'NAO_PERMITIDO', mensagem: 'Só quem criou a rodinha pode começar.' });
      this.exigirConvite(r, agora);
      const dentro = r.participantes.filter((p) => p.status === 'DENTRO');
      if (dentro.length < BAFO.minRoda) {
        throw new ConflictException({ codigo: 'POUCOS_JOGADORES', mensagem: `A rodinha precisa de pelo menos ${BAFO.minRoda} jogadores dentro.` });
      }
      await tx.rodaParticipante.updateMany({ where: { rodaId: id, status: 'CONVIDADO' }, data: { status: 'RECUSOU' } });
      await this.iniciar(tx, id, agora);
      return this.apresentar(await this.carregar(tx, id), eu);
    });
  }

  /** O anfitrião desfaz a rodinha antes de começar: todos recebem as figurinhas de volta. */
  async cancelar(eu: string, id: string, agora = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const r = await this.travar(tx, id, eu);
      if (r.anfitriaoId !== eu) throw new ForbiddenException({ codigo: 'NAO_PERMITIDO', mensagem: 'Só quem criou a rodinha pode cancelar.' });
      this.exigirConvite(r, agora);
      await devolverConvite(tx, r, 'CANCELADA', agora);
      return this.apresentar(await this.carregar(tx, id), eu);
    });
  }

  async bater(eu: string, id: string, precisao: number, agora = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const r = await this.travar(tx, id, eu);
      if (r.status !== 'JOGANDO') throw new ConflictException({ codigo: 'BAFO_ENCERRADO', mensagem: 'Esta rodinha não está em andamento.' });
      const p = r.participantes.find((x) => x.usuarioId === eu);
      if (!p || p.status !== 'DENTRO' || !p.lado) throw new ForbiddenException({ codigo: 'NAO_PERMITIDO', mensagem: 'Você não está nesta rodinha.' });
      let estado = r.estado as unknown as EstadoBafo;
      try {
        estado = bater(estado, p.lado, precisao, this.rng);
      } catch (e) {
        if (e instanceof ErroRegra) throw new UnprocessableEntityException({ codigo: e.codigo, mensagem: e.message });
        throw e;
      }
      let ganhos: { novas: string[]; recompensas: RecompensaNova[] } = { novas: [], recompensas: [] };
      if (estado.terminou) ganhos = await finalizar(tx, r, estado, 'FINALIZADA', agora, eu);
      else
        await tx.rodaBafo.update({
          where: { id },
          data: { estado: estado as unknown as Prisma.InputJsonValue, expiraEm: new Date(agora.getTime() + PRAZOS_BAFO.vezMs) },
        });
      return { ...this.apresentar(await this.carregar(tx, id), eu), ...ganhos };
    });
  }

  // ---------------------------------------------------------------------------

  /** Começa se ninguém falta responder; desfaz se sobrou menos de 3 dentro. */
  private async talvezComecar(tx: Tx, id: string, agora: Date) {
    const r = await this.carregar(tx, id);
    if (r.participantes.some((p) => p.status === 'CONVIDADO')) return;
    const dentro = r.participantes.filter((p) => p.status === 'DENTRO');
    if (dentro.length >= BAFO.minRoda) await this.iniciar(tx, id, agora);
    else await devolverConvite(tx, r, 'CANCELADA', agora);
  }

  private async iniciar(tx: Tx, id: string, agora: Date) {
    const r = await this.carregar(tx, id);
    // O anfitrião começa; os outros na ordem em que entraram.
    const dentro = r.participantes
      .filter((p) => p.status === 'DENTRO')
      .sort((a, b) => (a.usuarioId === r.anfitriaoId ? -1 : b.usuarioId === r.anfitriaoId ? 1 : (a.entrouEm?.getTime() ?? 0) - (b.entrouEm?.getTime() ?? 0)));
    const estado = montarRoda(dentro.map((p) => p.cartas as string[]), this.rng);
    const { bonusChance } = await this.eventos.efeitos(agora);
    estado.fatorChance = (estado.fatorChance ?? 1) * bonusChance;
    const lados = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (const [i, p] of dentro.entries()) {
      await tx.rodaParticipante.update({ where: { rodaId_usuarioId: { rodaId: id, usuarioId: p.usuarioId } }, data: { lado: lados[i] } });
    }
    await tx.rodaBafo.update({
      where: { id },
      data: {
        status: 'JOGANDO',
        estado: estado as unknown as Prisma.InputJsonValue,
        dia: diaLocal(agora),
        expiraEm: new Date(agora.getTime() + PRAZOS_BAFO.vezMs),
      },
    });
  }

  /** Convites vencidos: começa se der (3 ou mais dentro), senão devolve. Vezes vencidas são puladas. */
  private async expirarVencidas(agora: Date) {
    const vencidas = await this.prisma.rodaBafo.findMany({
      where: { status: { in: [...ABERTAS] }, expiraEm: { lte: agora } },
      select: { id: true },
      take: 30,
    });
    for (const v of vencidas) {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "RodaBafo" WHERE id = ${v.id} FOR UPDATE`;
        const r = await this.carregar(tx, v.id);
        if (r.expiraEm > agora) return;
        if (r.status === 'CONVITE') {
          if (r.participantes.filter((p) => p.status === 'DENTRO').length >= BAFO.minRoda) {
            await tx.rodaParticipante.updateMany({ where: { rodaId: r.id, status: 'CONVIDADO' }, data: { status: 'RECUSOU' } });
            await this.iniciar(tx, r.id, agora);
          } else await devolverConvite(tx, r, 'EXPIRADA', agora);
        } else if (r.status === 'JOGANDO') {
          let estado = r.estado as unknown as EstadoBafo;
          let prazo = r.expiraEm.getTime();
          while (!estado.terminou && prazo <= agora.getTime()) {
            estado = pularVez(estado);
            prazo += PRAZOS_BAFO.vezMs;
          }
          if (estado.terminou) await finalizar(tx, r, estado, 'EXPIRADA', agora, null);
          else await tx.rodaBafo.update({ where: { id: r.id }, data: { estado: estado as unknown as Prisma.InputJsonValue, expiraEm: new Date(prazo) } });
        }
      });
    }
  }

  private exigirConvite(r: RodaBafo, agora: Date) {
    if (r.status !== 'CONVITE') throw new ConflictException({ codigo: 'BAFO_ENCERRADO', mensagem: 'Esta rodinha já começou ou foi encerrada.' });
    if (r.expiraEm <= agora) throw new ConflictException({ codigo: 'BAFO_EXPIRADO', mensagem: 'O prazo deste convite acabou.' });
  }

  private carregar(tx: Tx | PrismaService, id: string) {
    return tx.rodaBafo.findUniqueOrThrow({ where: { id }, include: incluir });
  }

  private async buscar(tx: Tx | PrismaService, id: string, eu: string) {
    const r = await tx.rodaBafo.findUnique({ where: { id }, include: incluir });
    if (!r || !r.participantes.some((p) => p.usuarioId === eu)) {
      throw new NotFoundException({ codigo: 'BAFO_INEXISTENTE', mensagem: 'Rodinha não encontrada.' });
    }
    return r;
  }

  /** Trava a rodinha e os jogadores (sempre na mesma ordem, para não travar duas transações entre si). */
  private async travar(tx: Tx, id: string, eu: string) {
    const r0 = await this.buscar(tx, id, eu);
    await travarUsuarios(tx, r0.participantes.map((p) => p.usuarioId));
    await tx.$queryRaw`SELECT id FROM "RodaBafo" WHERE id = ${id} FOR UPDATE`;
    return this.carregar(tx, id);
  }

  /** Visão da rodinha para um jogador. Cartas para baixo não mostram qual figurinha são. */
  private apresentar(r: RodaCompleta, eu: string) {
    const estado = r.estado as unknown as EstadoBafo | null;
    const fim = !!estado?.terminou || !ABERTAS.includes(r.status as (typeof ABERTAS)[number]);
    const porLado = Object.fromEntries(r.participantes.filter((p) => p.lado).map((p) => [p.lado!, p]));
    const meu = r.participantes.find((p) => p.usuarioId === eu);
    const res = estado && fim ? resultadoBafo(estado) : null;
    const placar = (lado: string | null) => (lado && estado ? estado.monte.filter((c) => c.virou === lado).length : 0);
    const vez = estado && !estado.terminou && r.status === 'JOGANDO' ? porLado[estado.vez] : undefined;
    return {
      id: r.id,
      status: r.status,
      quantidade: r.quantidade,
      temporada: r.temporada,
      souAnfitriao: r.anfitriaoId === eu,
      anfitriao: r.anfitriao,
      jogadores: r.participantes.map((p) => ({
        id: p.usuarioId,
        apelido: p.usuario.apelido,
        status: p.status,
        lado: p.lado,
        minha: p.usuarioId === eu,
        placar: placar(p.lado),
      })),
      cartasAnfitriao: (r.participantes.find((p) => p.usuarioId === r.anfitriaoId)?.cartas as string[]) ?? [],
      monte: (estado?.monte ?? []).map((c) => ({
        minha: c.dono === meu?.lado,
        dono: porLado[c.dono]?.usuarioId ?? null,
        virouPor: c.virou ? (porLado[c.virou]?.usuarioId ?? null) : null,
        codigo: c.virou || fim ? c.codigo : null,
      })),
      batidas: (estado?.batidas ?? []).map((b) => ({
        jogadorId: porLado[b.lado]?.usuarioId ?? null,
        apelido: porLado[b.lado]?.usuario.apelido ?? '?',
        minha: b.lado === meu?.lado,
        precisao: b.precisao,
        viradas: b.viradas,
        especial: !!b.especial,
      })),
      vez: vez ? { id: vez.usuarioId, apelido: vez.usuario.apelido } : null,
      minhaVez: !!vez && vez.usuarioId === eu,
      recebi: res && meu?.lado ? (res[meu.lado]?.recebe ?? []) : null,
      expiraEm: r.expiraEm,
    };
  }
}

/** Para a exclusão de conta: devolve as figurinhas dos outros e tira o jogador das rodinhas abertas. */
export async function devolverRodasDaConta(tx: Tx, usuarioId: string, agora = new Date()) {
  const rodas = await tx.rodaBafo.findMany({
    where: { status: { in: [...ABERTAS] }, participantes: { some: { usuarioId } } },
    include: incluir,
  });
  for (const r of rodas) {
    if (r.status === 'CONVITE') {
      if (r.anfitriaoId === usuarioId) await devolverConvite(tx, r, 'CANCELADA', agora, usuarioId);
      else await tx.rodaParticipante.delete({ where: { rodaId_usuarioId: { rodaId: r.id, usuarioId } } });
    } else {
      await finalizar(tx, r, r.estado as unknown as EstadoBafo, 'CANCELADA', agora, null, usuarioId);
    }
  }
}

async function devolverConvite(tx: Tx, r: RodaCompleta | (RodaBafo & { participantes: RodaParticipante[] }), status: 'CANCELADA' | 'EXPIRADA', agora: Date, pular?: string) {
  for (const p of r.participantes) {
    if (p.status === 'DENTRO' && p.usuarioId !== pular) await creditar(tx, p.usuarioId, (p.cartas as string[]) ?? [], agora);
  }
  await tx.rodaBafo.update({ where: { id: r.id }, data: { status } });
}

async function finalizar(
  tx: Tx,
  r: RodaCompleta,
  estado: EstadoBafo,
  status: 'FINALIZADA' | 'EXPIRADA' | 'CANCELADA',
  agora: Date,
  eu: string | null,
  pular?: string,
) {
  const res = resultadoBafo(estado);
  let meus: { novas: string[]; recompensas: RecompensaNova[] } = { novas: [], recompensas: [] };
  for (const p of r.participantes) {
    if (p.status !== 'DENTRO' || !p.lado || p.usuarioId === pular) continue;
    const c = await creditar(tx, p.usuarioId, res[p.lado]?.recebe ?? [], agora);
    if (p.usuarioId === eu) meus = c;
  }
  await tx.rodaBafo.update({
    where: { id: r.id },
    data: { status, estado: { ...estado, terminou: true } as unknown as Prisma.InputJsonValue },
  });
  return meus;
}
