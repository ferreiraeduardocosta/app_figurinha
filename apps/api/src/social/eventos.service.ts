import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventoBafo, Prisma, Raridade } from '@prisma/client';
import { EstadoBafo, resultadoBafo } from '@craques-da-varzea/regras';
import { PrismaService } from '../prisma/prisma.service';

const DIA = 24 * 60 * 60 * 1000;
const RARIDADES: Raridade[] = ['COMUM', 'RARA', 'EPICA', 'LENDARIA'];

/** Efeitos dos eventos ativos sobre o bafo. */
export interface EfeitosBafo {
  multiplicadorLimite: number;
  bonusChance: number;
}

/**
 * Eventos de bafo criados no painel:
 * - DOBRADO: limite contra o computador × N e chance de virar maior (partidas começadas no período);
 * - TORNEIO: quem vencer mais partidas no período ganha pacotes;
 * - TEMATICO: torneio que só conta partidas com todas as figurinhas de um clube ou raridade.
 * Vitória = terminar a partida com mais figurinhas do que pôs. Prêmios são entregues uma vez,
 * na primeira consulta depois do fim.
 */
@Injectable()
export class EventosService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private ativosEm(agora: Date) {
    return this.prisma.eventoBafo.findMany({ where: { ativo: true, inicio: { lte: agora }, fim: { gt: agora } } });
  }

  async efeitos(agora = new Date()): Promise<EfeitosBafo> {
    const dobrados = (await this.ativosEm(agora)).filter((e) => e.tipo === 'DOBRADO');
    return {
      multiplicadorLimite: Math.max(1, ...dobrados.map((e) => e.multiplicadorLimite)),
      bonusChance: Math.max(1, ...dobrados.map((e) => e.bonusChance)),
    };
  }

  /** Eventos para o jogador: em andamento, próximos (14 dias) e encerrados há até 7 dias, com ranking. */
  async listar(eu: string, agora = new Date()) {
    await this.entregarPremiosVencidos(agora);
    const eventos = await this.prisma.eventoBafo.findMany({
      where: { ativo: true, fim: { gt: new Date(agora.getTime() - 7 * DIA) }, inicio: { lt: new Date(agora.getTime() + 14 * DIA) } },
      orderBy: { inicio: 'asc' },
    });
    const lista = [];
    for (const e of eventos) {
      const ranking = e.tipo === 'DOBRADO' ? null : await this.ranking(e, agora);
      const minha = ranking?.findIndex((r) => r.usuarioId === eu) ?? -1;
      lista.push({
        ...this.publico(e, agora),
        ranking: ranking?.slice(0, 10).map(({ apelido, vitorias }) => ({ apelido, vitorias })) ?? null,
        minhasVitorias: minha >= 0 ? ranking![minha].vitorias : 0,
        minhaPosicao: minha >= 0 ? minha + 1 : null,
      });
    }
    return lista;
  }

  // ---------------- Painel ----------------

  async listarAdmin(agora = new Date()) {
    await this.entregarPremiosVencidos(agora);
    const eventos = await this.prisma.eventoBafo.findMany({ orderBy: { inicio: 'desc' }, take: 50 });
    return Promise.all(
      eventos.map(async (e) => ({
        ...this.publico(e, agora),
        ativo: e.ativo,
        premiosEntreguesEm: e.premiosEntreguesEm,
        ranking: e.tipo === 'DOBRADO' ? null : (await this.ranking(e, agora)).slice(0, 5).map(({ apelido, vitorias }) => ({ apelido, vitorias })),
      })),
    );
  }

  async criar(adminApelido: string, corpo: Record<string, unknown>) {
    const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';
    if (nome.length < 3 || nome.length > 60) this.erro('nome', 'Nome com 3 a 60 caracteres.');
    const tipo = corpo.tipo as EventoBafo['tipo'];
    if (!['DOBRADO', 'TORNEIO', 'TEMATICO'].includes(tipo)) this.erro('tipo', 'Tipo inválido.');
    const inicio = this.dataHora(corpo.inicio, 'inicio');
    const fim = this.dataHora(corpo.fim, 'fim');
    if (fim <= inicio) this.erro('fim', 'O fim precisa ser depois do início.');
    if (fim.getTime() - inicio.getTime() > 31 * DIA) this.erro('fim', 'O evento pode durar no máximo 31 dias.');
    const dados: Prisma.EventoBafoCreateInput = {
      nome,
      descricao: typeof corpo.descricao === 'string' && corpo.descricao.trim() ? corpo.descricao.trim().slice(0, 200) : null,
      tipo,
      inicio,
      fim,
      criadoPor: adminApelido,
    };
    if (tipo === 'DOBRADO') {
      dados.multiplicadorLimite = this.inteiro(corpo.multiplicadorLimite, 'multiplicadorLimite', 1, 10, 2);
      const bonus = Number(corpo.bonusChance ?? 1.25);
      if (!Number.isFinite(bonus) || bonus < 1 || bonus > 2) this.erro('bonusChance', 'Bônus de chance entre 1 e 2 (ex.: 1,25 = +25%).');
      dados.bonusChance = bonus;
    } else {
      dados.premioPacotes = this.inteiro(corpo.premioPacotes, 'premioPacotes', 1, 20, 3);
      dados.premiados = this.inteiro(corpo.premiados, 'premiados', 1, 50, 3);
      if (tipo === 'TEMATICO') {
        const clube = typeof corpo.filtroClube === 'string' && corpo.filtroClube.trim() ? corpo.filtroClube.trim().toUpperCase() : null;
        const raridade = typeof corpo.filtroRaridade === 'string' && corpo.filtroRaridade ? (corpo.filtroRaridade as Raridade) : null;
        if (!clube && !raridade) this.erro('filtroClube', 'Escolha um clube ou uma raridade para o tema.');
        if (raridade && !RARIDADES.includes(raridade)) this.erro('filtroRaridade', 'Raridade inválida.');
        if (clube && !(await this.prisma.clube.findUnique({ where: { sigla: clube } }))) this.erro('filtroClube', `Clube ${clube} não existe.`);
        dados.filtroClube = clube;
        dados.filtroRaridade = raridade;
      }
    }
    await this.prisma.eventoBafo.create({ data: dados });
    return this.listarAdmin();
  }

  async definirAtivo(id: string, ativo: boolean) {
    const e = await this.prisma.eventoBafo.findUnique({ where: { id } });
    if (!e) throw new NotFoundException({ codigo: 'EVENTO_INEXISTENTE', mensagem: 'Evento não encontrado.' });
    await this.prisma.eventoBafo.update({ where: { id }, data: { ativo } });
    return this.listarAdmin();
  }

  // ---------------- Ranking e prêmios ----------------

  /** Vitórias por jogador em partidas que começaram e terminaram dentro do evento. */
  async ranking(e: EventoBafo, agora = new Date()) {
    const ate = e.fim < agora ? e.fim : agora;
    const janela = { status: 'FINALIZADA' as const, criadoEm: { gte: e.inicio }, atualizadoEm: { lte: ate } };
    const [bafos, rodas] = await Promise.all([
      this.prisma.bafo.findMany({ where: janela, select: { desafianteId: true, adversarioId: true, quantidade: true, estado: true } }),
      this.prisma.rodaBafo.findMany({ where: janela, select: { quantidade: true, estado: true, participantes: { select: { usuarioId: true, lado: true } } } }),
    ]);
    const tema = e.tipo === 'TEMATICO' ? await this.filtroTema(e) : null;
    const vitorias = new Map<string, number>();
    const contar = (usuarioId: string | null | undefined, recebe: number, quantidade: number) => {
      if (usuarioId && recebe > quantidade) vitorias.set(usuarioId, (vitorias.get(usuarioId) ?? 0) + 1);
    };
    for (const b of bafos) {
      const estado = b.estado as unknown as EstadoBafo | null;
      if (!estado || (tema && !estado.monte.every((c) => tema(c.codigo)))) continue;
      const r = resultadoBafo(estado);
      contar(b.desafianteId, r.A.recebe.length, b.quantidade);
      contar(b.adversarioId, r.B.recebe.length, b.quantidade);
    }
    for (const roda of rodas) {
      const estado = roda.estado as unknown as EstadoBafo | null;
      if (!estado || (tema && !estado.monte.every((c) => tema(c.codigo)))) continue;
      const r = resultadoBafo(estado);
      for (const p of roda.participantes) if (p.lado) contar(p.usuarioId, r[p.lado]?.recebe.length ?? 0, roda.quantidade);
    }
    const ids = [...vitorias.keys()];
    const usuarios = await this.prisma.usuario.findMany({ where: { id: { in: ids }, excluidoEm: null }, select: { id: true, apelido: true } });
    const apelido = Object.fromEntries(usuarios.map((u) => [u.id, u.apelido]));
    return ids
      .filter((id) => apelido[id])
      .map((id) => ({ usuarioId: id, apelido: apelido[id], vitorias: vitorias.get(id)! }))
      .sort((a, b) => b.vitorias - a.vitorias || a.apelido.localeCompare(b.apelido));
  }

  /** Entrega os prêmios dos torneios que já acabaram (uma única vez por evento). */
  async entregarPremiosVencidos(agora = new Date()) {
    const vencidos = await this.prisma.eventoBafo.findMany({
      where: { ativo: true, tipo: { not: 'DOBRADO' }, fim: { lte: agora }, premiosEntreguesEm: null, premiados: { gt: 0 } },
    });
    for (const e of vencidos) {
      const ganhadores = (await this.ranking(e, agora)).slice(0, e.premiados);
      await this.prisma.$transaction(async (tx) => {
        const atual = await tx.$queryRaw<{ entregue: Date | null }[]>`
          SELECT "premiosEntreguesEm" AS entregue FROM "EventoBafo" WHERE id = ${e.id} FOR UPDATE`;
        if (atual[0]?.entregue) return;
        for (const g of ganhadores) {
          await tx.usuario.update({ where: { id: g.usuarioId }, data: { pacotesBonus: { increment: e.premioPacotes } } });
        }
        await tx.eventoBafo.update({ where: { id: e.id }, data: { premiosEntreguesEm: agora } });
      });
    }
  }

  private async filtroTema(e: EventoBafo) {
    const figs = await this.prisma.figurinha.findMany({ select: { codigo: true, clubeSigla: true, raridade: true } });
    const ok = new Set(
      figs
        .filter((f) => (!e.filtroClube || f.clubeSigla === e.filtroClube) && (!e.filtroRaridade || f.raridade === e.filtroRaridade))
        .map((f) => f.codigo),
    );
    return (codigo: string) => ok.has(codigo);
  }

  private publico(e: EventoBafo, agora: Date) {
    return {
      id: e.id,
      nome: e.nome,
      descricao: e.descricao,
      tipo: e.tipo,
      inicio: e.inicio,
      fim: e.fim,
      situacao: agora < e.inicio ? 'EM_BREVE' : agora < e.fim ? 'AGORA' : 'ENCERRADO',
      multiplicadorLimite: e.multiplicadorLimite,
      bonusChance: e.bonusChance,
      filtroClube: e.filtroClube,
      filtroRaridade: e.filtroRaridade,
      premioPacotes: e.premioPacotes,
      premiados: e.premiados,
    };
  }

  private dataHora(v: unknown, campo: string): Date {
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(v)) {
      const d = new Date(`${v.slice(0, 16)}:00-03:00`);
      if (!Number.isNaN(d.getTime())) return d;
    }
    this.erro(campo, 'Data e hora inválidas.');
  }

  private inteiro(v: unknown, campo: string, min: number, max: number, padrao: number): number {
    if (v === undefined || v === null || v === '') return padrao;
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) this.erro(campo, `${campo}: número inteiro de ${min} a ${max}.`);
    return n;
  }

  private erro(campo: string, mensagem: string): never {
    throw new BadRequestException({ codigo: 'ENTRADA_INVALIDA', campo, mensagem });
  }
}
