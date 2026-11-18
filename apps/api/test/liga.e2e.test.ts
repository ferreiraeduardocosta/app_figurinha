/**
 * Craques da Várzea no servidor, com PostgreSQL de verdade.
 * Precisa de DATABASE_URL (banco migrado e com seed); sem ela, é pulado.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { CONFIG_LIGA, LigaService } from '../src/liga/liga.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe.skipIf(!process.env.DATABASE_URL)('Liga', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let liga: LigaService;
  const depoisDaRodada = (n: number) => new Date(liga.dataDaRodada(n).getTime() + 60_000);
  const placares = async () =>
    (
      await prisma.partida.findMany({
        where: { temporada: CONFIG_LIGA.temporada, simuladaEm: { not: null } },
        orderBy: [{ rodada: 'asc' }, { mandante: 'asc' }],
      })
    ).map((p) => `${p.rodada}:${p.mandante}${p.golsMandante}x${p.golsVisitante}${p.visitante}`);

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    await app.listen(0);
    prisma = app.get(PrismaService);
    liga = app.get(LigaService);
    await prisma.partida.deleteMany({ where: { temporada: CONFIG_LIGA.temporada } });
  });

  afterAll(async () => {
    // O calendário é recriado sozinho na próxima consulta.
    await prisma.partida.deleteMany({ where: { temporada: CONFIG_LIGA.temporada } });
    await app.close();
  });

  it('antes da 1ª rodada: cria o calendário e não simula nada', async () => {
    const p = await liga.painel(new Date(liga.dataDaRodada(1).getTime() - 60_000));
    expect(await prisma.partida.count({ where: { temporada: CONFIG_LIGA.temporada } })).toBe(56);
    expect(p).toMatchObject({ totalRodadas: 14, ultimaRodada: 0, proximaRodada: { numero: 1 }, emAlta: null, jogosDaUltima: [] });
    expect(p.jogosDaProxima).toHaveLength(4);
    expect(p.classificacao.every((l) => l.jogos === 0)).toBe(true);
  });

  it('simula as rodadas vencidas e monta tabela, artilharia e figurinha "Em alta"', async () => {
    const p = await liga.painel(depoisDaRodada(3));
    expect(p.ultimaRodada).toBe(3);
    expect(p.proximaRodada?.numero).toBe(4);
    expect(p.classificacao.every((l) => l.jogos === 3)).toBe(true);
    expect(p.jogosDaUltima).toHaveLength(4);
    const totalGols = (await prisma.partida.findMany({ where: { simuladaEm: { not: null } } })).reduce(
      (s, x) => s + x.golsMandante! + x.golsVisitante!,
      0,
    );
    expect(p.classificacao.reduce((s, l) => s + l.golsPro, 0)).toBe(totalGols);
    if (totalGols > 0) {
      expect(p.emAlta).toMatchObject({ rodada: 3 });
      expect(p.emAlta!.codigo).toMatch(/^[A-Z]{3}-\d{2}$/);
      expect(p.artilharia[0].gols).toBeGreaterThanOrEqual(p.artilharia.at(-1)!.gols);
    }
  });

  it('resultados já jogados não mudam; consultas simultâneas não simulam duas vezes', async () => {
    const antes = await placares();
    await Promise.all([liga.painel(depoisDaRodada(6)), liga.painel(depoisDaRodada(6)), liga.painel(depoisDaRodada(6))]);
    const depois = await placares();
    expect(depois).toHaveLength(24);
    expect(depois.slice(0, 12)).toEqual(antes);
  });

  it('a mesma semente dá os mesmos resultados', async () => {
    const original = await placares();
    await prisma.partida.deleteMany({ where: { temporada: CONFIG_LIGA.temporada } });
    await liga.painel(depoisDaRodada(6));
    expect(await placares()).toEqual(original);
  });

  it('GET /liga é público', async () => {
    const base = (await app.getUrl()).replace('[::1]', 'localhost');
    const r = await fetch(base + '/liga');
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo.classificacao).toHaveLength(8);
  });
});
