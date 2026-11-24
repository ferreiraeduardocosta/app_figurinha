/**
 * Eventos de bafo (fim de semana dobrado, torneio, temático), de ponta a ponta, com PostgreSQL de verdade.
 * Precisa de DATABASE_URL (banco migrado e com seed); sem ela, é pulado.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Prisma } from '@prisma/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar';
import { PrismaService } from '../src/prisma/prisma.service';

const temBanco = !!process.env.DATABASE_URL;
const HORA = 60 * 60 * 1000;

/** "YYYY-MM-DDTHH:mm" no horário de Brasília, como o painel manda. */
const brt = (d: Date) => new Date(d.getTime() - 3 * HORA).toISOString().slice(0, 16);

describe.skipIf(!temBanco)('Eventos de bafo', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let base: string;
  const sufixo = String(Date.now()).slice(-8);
  const u = {} as Record<'admin' | 'ana' | 'bia', { id: string; token: string }>;

  const chamar = async (quem: keyof typeof u, metodo: string, rota: string, corpo?: unknown) => {
    const r = await fetch(base + rota, {
      method: metodo,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${u[quem].token}` },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const texto = await r.text();
    return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
  };

  /** Partida 1x1 já terminada: A virou `viradasA` cartas do monte de 2. */
  const partida = (viradasA: number[], codigos = ['UNI-05', 'SER-04'], criadoEm = new Date(Date.now() - 10 * 60 * 1000)) =>
    prisma.bafo.create({
      data: {
        desafianteId: u.ana.id,
        adversarioId: u.bia.id,
        status: 'FINALIZADA',
        quantidade: 1,
        cartasA: [codigos[0]],
        criadoEm,
        expiraEm: new Date(),
        estado: {
          monte: codigos.map((codigo, i) => ({ codigo, dono: i === 0 ? 'A' : 'B', virou: viradasA.includes(i) ? 'A' : 'B' })),
          vez: 'A',
          terminou: true,
          batidas: [
            { lado: 'A', precisao: 0.9, viradas: viradasA },
            { lado: 'B', precisao: 0.9, viradas: [0, 1].filter((i) => !viradasA.includes(i)) },
          ],
        } as unknown as Prisma.InputJsonValue,
      },
    });

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configurarApp(app);
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    for (const nome of ['admin', 'ana', 'bia'] as const) {
      const r = await fetch(base + '/auth/cadastro', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apelido: `ev${nome}_${sufixo}`, email: `evento-e2e-${nome}-${sufixo}@exemplo.com`, senha: 'senha-forte-123' }),
      }).then((x) => x.json());
      u[nome] = { id: r.usuario.id, token: r.token };
    }
    await prisma.usuario.update({ where: { id: u.admin.id }, data: { papel: 'ADMIN' } });
  });

  afterEach(async () => {
    await prisma.eventoBafo.deleteMany({ where: { criadoPor: `evadmin_${sufixo}` } });
    await prisma.bafo.deleteMany({ where: { desafianteId: u.ana.id } });
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { startsWith: 'evento-e2e-' } } });
    await app.close();
  });

  it('só admin cria; valida datas e tipo', async () => {
    const agora = new Date();
    const ok = { nome: 'Fim de semana dobrado', tipo: 'DOBRADO', inicio: brt(agora), fim: brt(new Date(agora.getTime() + 48 * HORA)) };
    expect((await chamar('ana', 'POST', '/admin/eventos', ok)).status).toBe(403);
    expect((await chamar('admin', 'POST', '/admin/eventos', { ...ok, tipo: 'XYZ' })).corpo.campo).toBe('tipo');
    expect((await chamar('admin', 'POST', '/admin/eventos', { ...ok, fim: ok.inicio })).corpo.campo).toBe('fim');
    expect((await chamar('admin', 'POST', '/admin/eventos', { ...ok, inicio: '25/12/2026' })).corpo.campo).toBe('inicio');
    expect((await chamar('admin', 'POST', '/admin/eventos', { ...ok, tipo: 'TEMATICO' })).corpo.campo).toBe('filtroClube');
    const r = await chamar('admin', 'POST', '/admin/eventos', ok);
    expect(r.status).toBe(201);
    expect(r.corpo[0]).toMatchObject({ nome: ok.nome, multiplicadorLimite: 2, bonusChance: 1.25, ativo: true });
  });

  it('fim de semana dobrado: dobra o limite contra o computador e aumenta a chance', async () => {
    const antes = (await chamar('ana', 'GET', '/bafo')).corpo;
    expect(antes.limiteComputador).toBe(10);
    const agora = new Date();
    await chamar('admin', 'POST', '/admin/eventos', {
      nome: 'Dobradinha',
      tipo: 'DOBRADO',
      inicio: brt(new Date(agora.getTime() - HORA)),
      fim: brt(new Date(agora.getTime() + HORA)),
      multiplicadorLimite: 3,
      bonusChance: 1.5,
    });
    const durante = (await chamar('ana', 'GET', '/bafo')).corpo;
    expect(durante).toMatchObject({ limiteComputador: 30, bonusChance: 1.5 });
    await prisma.itemAlbum.upsert({
      where: { usuarioId_figurinhaCodigo: { usuarioId: u.ana.id, figurinhaCodigo: 'UNI-05' } },
      create: { usuarioId: u.ana.id, figurinhaCodigo: 'UNI-05', quantidade: 3 },
      update: { quantidade: 3 },
    });
    const p = await chamar('ana', 'POST', '/bafo/computador', { figurinhas: ['UNI-05'] });
    expect(p.status).toBe(201);
    const salvo = await prisma.bafo.findUniqueOrThrow({ where: { id: p.corpo.id } });
    expect((salvo.estado as { fatorChance?: number }).fatorChance).toBe(1.5);
    const eventos = (await chamar('ana', 'GET', '/bafo/eventos')).corpo;
    expect(eventos.find((e: { nome: string }) => e.nome === 'Dobradinha')).toMatchObject({ situacao: 'AGORA', ranking: null });
  });

  it('torneio: conta vitórias no período e entrega os pacotes uma vez só, ao fim', async () => {
    const agora = new Date();
    const criado = await chamar('admin', 'POST', '/admin/eventos', {
      nome: 'Torneio relâmpago',
      tipo: 'TORNEIO',
      inicio: brt(new Date(agora.getTime() - HORA)),
      fim: brt(new Date(agora.getTime() + HORA)),
      premioPacotes: 2,
      premiados: 1,
    });
    const id = criado.corpo.find((e: { nome: string }) => e.nome === 'Torneio relâmpago').id;
    await partida([0, 1]); // Ana leva as 2: vitória dela
    await partida([0, 1]);
    await partida([]); // Bia leva as 2
    await partida([1]); // cada um fica com 1: ninguém vence
    await partida([0, 1], ['UNI-05', 'SER-04'], new Date(agora.getTime() - 3 * HORA)); // antes do evento: não conta

    let ev = (await chamar('bia', 'GET', '/bafo/eventos')).corpo.find((e: { id: string }) => e.id === id);
    expect(ev.situacao).toBe('AGORA');
    expect(ev.ranking.filter((r: { apelido: string }) => r.apelido.endsWith(sufixo))).toEqual([
      { apelido: `evana_${sufixo}`, vitorias: 2 },
      { apelido: `evbia_${sufixo}`, vitorias: 1 },
    ]);
    expect(ev.minhasVitorias).toBe(1);
    expect(ev.minhaPosicao).toBeGreaterThanOrEqual(2);

    const pacotes = async () => (await prisma.usuario.findUniqueOrThrow({ where: { id: u.ana.id } })).pacotesBonus;
    const antes = await pacotes();
    // Partidas de fora do teste não entram no prêmio: só as do período, que são as nossas.
    await prisma.eventoBafo.update({ where: { id }, data: { fim: new Date() } });
    ev = (await chamar('ana', 'GET', '/bafo/eventos')).corpo.find((e: { id: string }) => e.id === id);
    expect(ev.situacao).toBe('ENCERRADO');
    await chamar('bia', 'GET', '/bafo/eventos');
    await chamar('admin', 'GET', '/admin/eventos');
    expect(await pacotes()).toBe(antes + 2);
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: u.bia.id } })).pacotesBonus).toBe(0);
  });

  it('temático: só conta partidas com todas as figurinhas do tema; desativar tira da lista', async () => {
    const agora = new Date();
    const criado = await chamar('admin', 'POST', '/admin/eventos', {
      nome: 'Clássico do UNI',
      tipo: 'TEMATICO',
      inicio: brt(new Date(agora.getTime() - HORA)),
      fim: brt(new Date(agora.getTime() + HORA)),
      filtroClube: 'uni',
    });
    const id = criado.corpo.find((e: { nome: string }) => e.nome === 'Clássico do UNI').id;
    await partida([0, 1], ['UNI-05', 'UNI-06']);
    await partida([0, 1], ['UNI-05', 'SER-04']); // mistura clubes: não conta
    let ev = (await chamar('ana', 'GET', '/bafo/eventos')).corpo.find((e: { id: string }) => e.id === id);
    expect(ev).toMatchObject({ filtroClube: 'UNI', minhasVitorias: 1 });
    await chamar('admin', 'PATCH', `/admin/eventos/${id}`, { ativo: false });
    ev = (await chamar('ana', 'GET', '/bafo/eventos')).corpo.find((e: { id: string }) => e.id === id);
    expect(ev).toBeUndefined();
  });
});
