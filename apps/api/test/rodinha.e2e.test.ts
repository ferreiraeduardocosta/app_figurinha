/**
 * Rodinha de bafo (3 a 6 amigos), de ponta a ponta, com PostgreSQL de verdade.
 * Precisa de DATABASE_URL (banco migrado e com seed); sem ela, é pulado.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const temBanco = !!process.env.DATABASE_URL;
const NOMES = ['ana', 'bia', 'caio', 'davi', 'eva'] as const;
type Nome = (typeof NOMES)[number];

describe.skipIf(!temBanco)('Rodinha de bafo', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let base: string;
  const sufixo = String(Date.now()).slice(-8);
  const j = {} as Record<Nome, { id: string; token: string }>;

  const chamar = async (quem: Nome, metodo: string, rota: string, corpo?: unknown) => {
    const r = await fetch(base + rota, {
      method: metodo,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${j[quem].token}` },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const texto = await r.text();
    return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
  };
  const definir = async (quem: Nome, itens: Record<string, number>) => {
    await prisma.itemAlbum.deleteMany({ where: { usuarioId: j[quem].id } });
    await prisma.itemAlbum.createMany({
      data: Object.entries(itens).map(([figurinhaCodigo, quantidade]) => ({ usuarioId: j[quem].id, figurinhaCodigo, quantidade })),
    });
  };
  const total = async (quem: Nome) =>
    (await prisma.itemAlbum.findMany({ where: { usuarioId: j[quem].id } })).reduce((s, i) => s + i.quantidade, 0);

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    for (const nome of NOMES) {
      const r = await fetch(base + '/auth/cadastro', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apelido: `r${nome}_${sufixo}`, email: `roda-e2e-${nome}-${sufixo}@exemplo.com`, senha: 'senha-forte-123' }),
      }).then((x) => x.json());
      j[nome] = { id: r.usuario.id, token: r.token };
    }
    // Ana é amiga de todos; Eva não é amiga de ninguém.
    for (const nome of ['bia', 'caio', 'davi'] as const) {
      await prisma.amizade.create({ data: { solicitanteId: j.ana.id, destinatarioId: j[nome].id, status: 'ACEITA', aceitaEm: new Date() } });
    }
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { startsWith: 'roda-e2e-' } } });
    await app.close();
  });

  beforeEach(async () => {
    await prisma.rodaBafo.deleteMany({ where: { anfitriaoId: j.ana.id } });
    await definir('ana', { 'UNI-05': 4 });
    await definir('bia', { 'SER-04': 4 });
    await definir('caio', { 'TUB-07': 4 });
    await definir('davi', { 'POL-05': 4 });
  });

  it('convida, todos entram, começa sozinha e joga até o fim sem sumir figurinha', async () => {
    const antes = (await Promise.all((['ana', 'bia', 'caio', 'davi'] as const).map(total))).reduce((a, b) => a + b, 0);
    const c = await chamar('ana', 'POST', '/bafo/rodas', { convidados: [j.bia.id, j.caio.id, j.davi.id], figurinhas: ['UNI-05', 'UNI-05'] });
    expect(c.status).toBe(201);
    expect(c.corpo).toMatchObject({ status: 'CONVITE', souAnfitriao: true, quantidade: 2 });
    expect((await chamar('bia', 'GET', '/bafo/rodas')).corpo.convites).toHaveLength(1);
    expect((await chamar('bia', 'GET', '/eu')).corpo.pendencias.bafo).toBeGreaterThanOrEqual(1);

    expect((await chamar('bia', 'POST', `/bafo/rodas/${c.corpo.id}/entrar`, { figurinhas: ['SER-04'] })).corpo.codigo).toBe('BAFO_INVALIDO');
    for (const [nome, cod] of [['bia', 'SER-04'], ['caio', 'TUB-07'], ['davi', 'POL-05']] as const) {
      const r = await chamar(nome, 'POST', `/bafo/rodas/${c.corpo.id}/entrar`, { figurinhas: [cod, cod] });
      expect(r.status).toBe(200);
    }
    let v = (await chamar('ana', 'GET', `/bafo/rodas/${c.corpo.id}`)).corpo;
    expect(v.status).toBe('JOGANDO');
    expect(v.monte).toHaveLength(8);
    expect(v.jogadores.filter((x: { lado: string | null }) => x.lado)).toHaveLength(4);
    expect(v.vez.id).toBe(j.ana.id);

    // Bate cada um na sua vez, em cobrinha, até acabar.
    let voltas = 0;
    while (v.status === 'JOGANDO' && voltas++ < 20) {
      const quem = NOMES.find((n) => j[n].id === v.vez.id)!;
      const outro = NOMES.find((n) => n !== quem && ['ana', 'bia', 'caio', 'davi'].includes(n))!;
      expect((await chamar(outro, 'POST', `/bafo/rodas/${v.id}/bater`, { precisao: 0.5 })).corpo.codigo).toBe('BAFO_INVALIDO');
      const r = await chamar(quem, 'POST', `/bafo/rodas/${v.id}/bater`, { precisao: 0.8 });
      expect(r.status).toBe(200);
      v = r.corpo;
    }
    expect(v.status).toBe('FINALIZADA');
    expect(v.batidas.length).toBeLessThanOrEqual(12);
    const depois = (await Promise.all((['ana', 'bia', 'caio', 'davi'] as const).map(total))).reduce((a, b) => a + b, 0);
    expect(depois).toBe(antes);
    const soma = v.jogadores.reduce((s: number, x: { placar: number }) => s + x.placar, 0);
    expect(soma).toBe(v.monte.filter((m: { virouPor: string | null }) => m.virouPor).length);
  });

  it('anfitrião pode começar com 3; quem não respondeu fica de fora', async () => {
    const c = await chamar('ana', 'POST', '/bafo/rodas', { convidados: [j.bia.id, j.caio.id, j.davi.id], figurinhas: ['UNI-05'] });
    await chamar('bia', 'POST', `/bafo/rodas/${c.corpo.id}/entrar`, { figurinhas: ['SER-04'] });
    expect((await chamar('ana', 'POST', `/bafo/rodas/${c.corpo.id}/comecar`)).corpo.codigo).toBe('POUCOS_JOGADORES');
    expect((await chamar('bia', 'POST', `/bafo/rodas/${c.corpo.id}/comecar`)).status).toBe(403);
    await chamar('caio', 'POST', `/bafo/rodas/${c.corpo.id}/entrar`, { figurinhas: ['TUB-07'] });
    const r = await chamar('ana', 'POST', `/bafo/rodas/${c.corpo.id}/comecar`);
    expect(r.corpo.status).toBe('JOGANDO');
    expect(r.corpo.monte).toHaveLength(3);
    expect(r.corpo.jogadores.find((x: { id: string }) => x.id === j.davi.id).status).toBe('RECUSOU');
    expect(await total('davi')).toBe(4);
  });

  it('se recusas deixam menos de 3, a rodinha é desfeita e as figurinhas voltam', async () => {
    const c = await chamar('ana', 'POST', '/bafo/rodas', { convidados: [j.bia.id, j.caio.id], figurinhas: ['UNI-05', 'UNI-05'] });
    expect(await total('ana')).toBe(2);
    await chamar('bia', 'POST', `/bafo/rodas/${c.corpo.id}/entrar`, { figurinhas: ['SER-04', 'SER-04'] });
    const r = await chamar('caio', 'POST', `/bafo/rodas/${c.corpo.id}/recusar`);
    expect(r.corpo.status).toBe('CANCELADA');
    expect(await total('ana')).toBe(4);
    expect(await total('bia')).toBe(4);
  });

  it('cancelar devolve; só amigos; de 2 a 5 convidados', async () => {
    expect((await chamar('ana', 'POST', '/bafo/rodas', { convidados: [j.bia.id], figurinhas: ['UNI-05'] })).corpo.codigo).toBe('BAFO_INVALIDO');
    expect((await chamar('ana', 'POST', '/bafo/rodas', { convidados: [j.bia.id, j.eva.id], figurinhas: ['UNI-05'] })).corpo.codigo).toBe('SO_ENTRE_AMIGOS');
    const c = await chamar('ana', 'POST', '/bafo/rodas', { convidados: [j.bia.id, j.caio.id], figurinhas: ['UNI-05'] });
    await chamar('bia', 'POST', `/bafo/rodas/${c.corpo.id}/entrar`, { figurinhas: ['SER-04'] });
    expect((await chamar('ana', 'POST', `/bafo/rodas/${c.corpo.id}/cancelar`)).corpo.status).toBe('CANCELADA');
    expect(await total('ana')).toBe(4);
    expect(await total('bia')).toBe(4);
  });

  it('vez vencida é pulada e a partida segue', async () => {
    const c = await chamar('ana', 'POST', '/bafo/rodas', { convidados: [j.bia.id, j.caio.id], figurinhas: ['UNI-05'] });
    await chamar('bia', 'POST', `/bafo/rodas/${c.corpo.id}/entrar`, { figurinhas: ['SER-04'] });
    await chamar('caio', 'POST', `/bafo/rodas/${c.corpo.id}/entrar`, { figurinhas: ['TUB-07'] });
    await prisma.rodaBafo.update({ where: { id: c.corpo.id }, data: { expiraEm: new Date(Date.now() - 1000) } });
    const v = (await chamar('bia', 'GET', `/bafo/rodas/${c.corpo.id}`)).corpo;
    expect(v.batidas[0]).toMatchObject({ jogadorId: j.ana.id, viradas: [] });
    expect(v.vez.id).toBe(j.bia.id);
  });
});
