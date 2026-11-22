import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  GolMarcado,
  ResultadoPartida,
  TimeLiga,
  classificar,
  craqueDaRodada,
  gerarCalendario,
  simularRodada,
} from '@craques-da-varzea/regras';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

const DADOS_DIR = process.env.DADOS_DIR ?? resolve(__dirname, '../../../../data/temporada1');

interface ConfigLiga {
  temporada: number;
  primeiraRodada: string;
  intervaloDias: number;
  semente: string;
}

export const CONFIG_LIGA: ConfigLiga = JSON.parse(readFileSync(resolve(DADOS_DIR, 'liga.json'), 'utf8'));
const MIN_MS = 60 * 1000;

/** Data de início, intervalo entre rodadas e versão (muda o sorteio a cada reinício). */
export interface AgendaLiga {
  primeiraRodada: Date;
  intervaloMinutos: number;
  versao: number;
}

const AGENDA_PADRAO: AgendaLiga = {
  primeiraRodada: new Date(CONFIG_LIGA.primeiraRodada),
  intervaloMinutos: CONFIG_LIGA.intervaloDias * 24 * 60,
  versao: 0,
};
/** Chave do lock do Postgres que impede duas simulações da mesma rodada ao mesmo tempo. */
const LOCK_LIGA = 7_331_001;

/**
 * Craques da Várzea: calendário de turno e returno e simulação das rodadas.
 * Não há agendador: cada consulta simula as rodadas cuja data já passou
 * (uma única vez, sob lock). A semente pode ser trocada por LIGA_SEMENTE
 * para os resultados não serem previsíveis por quem lê o repositório.
 */
@Injectable()
export class LigaService {
  /** Agendas lidas do banco por temporada (null = temporada sem liga marcada). */
  private agendas = new Map<number, AgendaLiga | null>([[CONFIG_LIGA.temporada, AGENDA_PADRAO]]);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private semente(temporada: number) {
    const base = process.env.LIGA_SEMENTE || CONFIG_LIGA.semente;
    const versao = this.agendas.get(temporada)?.versao ?? 0;
    return versao ? `${base}:v${versao}` : base;
  }

  /**
   * Agenda da liga de uma temporada. A Temporada 1 usa o liga.json enquanto o painel não
   * marcar outra data; as demais só têm liga depois de marcada no painel.
   */
  async agenda(temporada = CONFIG_LIGA.temporada): Promise<AgendaLiga | null> {
    const c = await this.prisma.configuracaoLiga.findUnique({ where: { temporada } });
    const a = c
      ? { primeiraRodada: c.primeiraRodada, intervaloMinutos: c.intervaloMinutos, versao: c.versao }
      : temporada === CONFIG_LIGA.temporada
        ? AGENDA_PADRAO
        : null;
    this.agendas.set(temporada, a);
    return a;
  }

  dataDaRodada(rodada: number, temporada = CONFIG_LIGA.temporada) {
    const a = this.agendas.get(temporada);
    if (!a) throw new Error(`Temporada ${temporada} sem liga marcada.`);
    return new Date(a.primeiraRodada.getTime() + (rodada - 1) * a.intervaloMinutos * MIN_MS);
  }

  /**
   * Marca (ou reinicia) a liga de uma temporada: apaga calendário e resultados e recomeça
   * na rodada 1, com a data de início e o intervalo escolhidos. A versão sobe para os
   * resultados mudarem.
   */
  async reiniciar(primeiraRodada: Date, intervaloMinutos: number, temporada = CONFIG_LIGA.temporada) {
    if (!(await this.prisma.temporada.findUnique({ where: { numero: temporada } }))) {
      throw new NotFoundException({ codigo: 'TEMPORADA_INEXISTENTE', mensagem: `Temporada ${temporada} não existe.` });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_LIGA})`;
      const atual = await tx.configuracaoLiga.findUnique({ where: { temporada } });
      await tx.partida.deleteMany({ where: { temporada } });
      await tx.configuracaoLiga.upsert({
        where: { temporada },
        create: { temporada, primeiraRodada, intervaloMinutos, versao: 1 },
        update: { primeiraRodada, intervaloMinutos, versao: (atual?.versao ?? 0) + 1 },
      });
    });
    await this.agenda(temporada);
    return this.situacao(temporada);
  }

  /** Resumo para o painel. */
  async situacao(temporada = CONFIG_LIGA.temporada, agora = new Date()) {
    await this.atualizar(agora, temporada);
    const a = this.agendas.get(temporada);
    if (!a) return { temporada, marcada: false as const };
    const [total, disputadas] = await Promise.all([
      this.prisma.partida.findMany({ where: { temporada }, select: { rodada: true }, distinct: ['rodada'] }),
      this.prisma.partida.findMany({ where: { temporada, simuladaEm: { not: null } }, select: { rodada: true }, distinct: ['rodada'] }),
    ]);
    const proxima = disputadas.length < total.length ? disputadas.length + 1 : null;
    return {
      temporada,
      marcada: true as const,
      primeiraRodada: a.primeiraRodada,
      intervaloMinutos: a.intervaloMinutos,
      versao: a.versao,
      totalRodadas: total.length,
      rodadasDisputadas: disputadas.length,
      proximaRodada: proxima ? { numero: proxima, data: this.dataDaRodada(proxima, temporada) } : null,
    };
  }

  /** Cria o calendário (se faltar) e simula as rodadas vencidas. */
  async atualizar(agora = new Date(), temporada = CONFIG_LIGA.temporada) {
    if (!(await this.agenda(temporada))) return;
    const pendentes = await this.prisma.partida.count({ where: { temporada, simuladaEm: null, dataPrevista: { lte: agora } } });
    const existe = await this.prisma.partida.count({ where: { temporada } });
    if (existe > 0 && pendentes === 0) return;

    await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_LIGA})`;
        if ((await tx.partida.count({ where: { temporada } })) === 0) {
          const siglas = (await tx.clube.findMany({ where: { temporada }, select: { sigla: true }, orderBy: { sigla: 'asc' } })).map((c) => c.sigla);
          await tx.partida.createMany({
            data: gerarCalendario(siglas).map((p) => ({ temporada, ...p, dataPrevista: this.dataDaRodada(p.rodada, temporada) })),
          });
        }
        const vencidas = await tx.partida.findMany({
          where: { temporada, simuladaEm: null, dataPrevista: { lte: agora } },
          orderBy: [{ rodada: 'asc' }, { mandante: 'asc' }],
        });
        if (vencidas.length === 0) return;
        const times = await this.times(tx, temporada);
        for (const rodada of [...new Set(vencidas.map((p) => p.rodada))]) {
          const jogos = vencidas.filter((p) => p.rodada === rodada);
          const resultados = simularRodada(times, jogos, `${this.semente(temporada)}:${temporada}`);
          for (const [i, r] of resultados.entries()) {
            await tx.partida.update({
              where: { id: jogos[i].id },
              data: {
                golsMandante: r.golsMandante,
                golsVisitante: r.golsVisitante,
                gols: r.gols as unknown as Prisma.InputJsonValue,
                simuladaEm: agora,
              },
            });
          }
        }
      },
      { timeout: 20_000 },
    );
  }

  /** Tudo que a tela da liga precisa. */
  async painel(agora = new Date(), temporada = CONFIG_LIGA.temporada) {
    await this.atualizar(agora, temporada);
    const [partidas, clubes, jogadores] = await Promise.all([
      this.prisma.partida.findMany({ where: { temporada }, orderBy: [{ rodada: 'asc' }, { mandante: 'asc' }] }),
      this.prisma.clube.findMany({ where: { temporada }, select: { sigla: true, nome: true }, orderBy: { sigla: 'asc' } }),
      this.prisma.figurinha.findMany({
        where: { tipo: 'JOGADOR', temporada },
        select: { codigo: true, nome: true, apelido: true, clubeSigla: true, ataque: true },
      }),
    ]);
    const jogadas = partidas.filter((p) => p.simuladaEm);
    const resultados: ResultadoPartida[] = jogadas.map((p) => ({
      mandante: p.mandante,
      visitante: p.visitante,
      golsMandante: p.golsMandante!,
      golsVisitante: p.golsVisitante!,
      gols: (p.gols as unknown as GolMarcado[]) ?? [],
    }));
    const ultimaRodada = jogadas.length ? Math.max(...jogadas.map((p) => p.rodada)) : 0;
    const totalRodadas = partidas.length ? Math.max(...partidas.map((p) => p.rodada)) : 0;
    const proxima = partidas.find((p) => !p.simuladaEm)?.rodada ?? null;
    const porCodigo = Object.fromEntries(jogadores.map((j) => [j.codigo, j]));
    const nome = (codigo: string) => porCodigo[codigo]?.apelido ?? porCodigo[codigo]?.nome ?? codigo;

    const gols: Record<string, number> = {};
    for (const r of resultados) for (const g of r.gols) gols[g.codigo] = (gols[g.codigo] ?? 0) + 1;
    const artilharia = Object.entries(gols)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([codigo, n]) => ({ codigo, nome: nome(codigo), clube: porCodigo[codigo]?.clubeSigla, gols: n }));

    const ataques = Object.fromEntries(jogadores.map((j) => [j.codigo, j.ataque ?? 0]));
    const craque = ultimaRodada
      ? craqueDaRodada(resultados.filter((_, i) => jogadas[i].rodada === ultimaRodada), ataques)
      : null;

    const partidaPublica = (p: (typeof partidas)[number]) => ({
      rodada: p.rodada,
      mandante: p.mandante,
      visitante: p.visitante,
      data: p.dataPrevista,
      golsMandante: p.golsMandante,
      golsVisitante: p.golsVisitante,
      gols: ((p.gols as unknown as GolMarcado[]) ?? []).map((g) => ({ ...g, nome: nome(g.codigo) })),
    });

    return {
      temporada,
      totalRodadas,
      ultimaRodada,
      // Temporada sem liga marcada ainda (só o álbum está aberto).
      marcada: this.agendas.get(temporada) != null,
      proximaRodada: proxima ? { numero: proxima, data: this.dataDaRodada(proxima, temporada) } : null,
      classificacao: classificar(
        clubes.map((c) => c.sigla),
        resultados,
      ),
      jogosDaUltima: partidas.filter((p) => p.rodada === ultimaRodada).map(partidaPublica),
      jogosDaProxima: proxima ? partidas.filter((p) => p.rodada === proxima).map(partidaPublica) : [],
      artilharia,
      // Figurinha "Em alta" da semana: o craque da última rodada.
      emAlta: craque ? { ...craque, nome: nome(craque.codigo), rodada: ultimaRodada } : null,
    };
  }

  private async times(tx: Prisma.TransactionClient, temporada: number): Promise<Record<string, TimeLiga>> {
    const lista = await tx.figurinha.findMany({
      where: { tipo: 'JOGADOR', temporada, ataque: { not: null } },
      select: { codigo: true, clubeSigla: true, posicao: true, ataque: true, defesa: true, tecnica: true, velocidade: true, fisico: true },
    });
    const times: Record<string, TimeLiga> = {};
    for (const f of lista) {
      (times[f.clubeSigla] ??= { sigla: f.clubeSigla, jogadores: [] }).jogadores.push({
        codigo: f.codigo,
        posicao: f.posicao ?? 'MEI',
        ataque: f.ataque!,
        defesa: f.defesa!,
        tecnica: f.tecnica!,
        velocidade: f.velocidade!,
        fisico: f.fisico!,
      });
    }
    return times;
  }
}
