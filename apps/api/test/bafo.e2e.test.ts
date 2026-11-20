/**
 * Bafo contra o computador e entre amigos, de ponta a ponta, com PostgreSQL de verdade.
 * Precisa de DATABASE_URL (banco migrado e com seed); sem ela, é pulado.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BAFO } from '@craques-da-varzea/regras';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const temBanco = !!process.env.DATABASE_URL;

describe.skipIf(!temBanco)('Bafo', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let base: string;
  const sufixo = String(Date.now()).slice(-8);
  const j: Record<'ana' | 'bia' | 'caio', { id: string; token: string; apelido: string }> = {} as never;

  const chamar = async (metodo: string, rota: string, token: string, corpo?: unknown) => {
    const r = await fetch(base + rota, {
      method: metodo,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const texto = await r.text();
    return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
  };
  const como = (quem: keyof typeof j) => ({
    get: (rota: string) => chamar('GET', rota, j[quem].token),
    post: (rota: string, corpo?: unknown) => chamar('POST', rota, j[quem].token, corpo),
  });
  const ana = como('ana');
  const bia = como('bia');
  const caio = como('caio');

  const definir = async (quem: keyof typeof j, itens: Record<string, number>) => {
    await prisma.itemAlbum.deleteMany({ where: { usuarioId: j[quem].id } });
    await prisma.itemAlbum.createMany({
      data: Object.entries(itens).map(([figurinhaCodigo, quantidade]) => ({ usuarioId: j[quem].id, figurinhaCodigo, quantidade })),
    });
  };
  const quantidades = async (quem: keyof typeof j) =>
    Object.fromEntries(
      (await prisma.itemAlbum.findMany({ where: { usuarioId: j[quem].id, quantidade: { gt: 0 } } })).map((i) => [i.figurinhaCodigo, i.quantidade]),
    );
  const total = (q: Record<string, number>) => Object.values(q).reduce((s, n) => s + n, 0);

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    for (const nome of ['ana', 'bia', 'caio'] as const) {
      const apelido = `b${nome}_${sufixo}`;
      const r = await fetch(base + '/auth/cadastro', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apelido, email: `bafo-e2e-${nome}-${sufixo}@exemplo.com`, senha: 'senha-forte-123' }),
      }).then((x) => x.json());
      j[nome] = { id: r.usuario.id, token: r.token, apelido };
    }
    await prisma.amizade.create({ data: { solicitanteId: j.ana.id, destinatarioId: j.bia.id, status: 'ACEITA', aceitaEm: new Date() } });
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { startsWith: 'bafo-e2e-' } } });
    await app.close();
  });

  beforeEach(async () => {
    await prisma.bafo.deleteMany({ where: { OR: [{ desafianteId: { in: Object.values(j).map((x) => x.id) } }] } });
  });

  it('contra o computador: reserva as repetidas, joga até o fim e entrega o resultado', async () => {
    await definir('ana', { 'UNI-05': 3, 'TUB-07': 2 });
    const r = await ana.post('/bafo/computador', { figurinhas: ['UNI-05', 'UNI-05', 'tub-07'] });
    expect(r.status).toBe(201);
    expect(r.corpo).toMatchObject({ status: 'JOGANDO', contraComputador: true, minhaVez: true, adversario: { apelido: 'Computador' } });
    expect(r.corpo.monte).toHaveLength(6);
    // Cartas para baixo não revelam a figurinha.
    expect(r.corpo.monte.every((c: { codigo: string | null }) => c.codigo === null)).toBe(true);
    expect(await quantidades('ana')).toEqual({ 'UNI-05': 1, 'TUB-07': 1 });

    let p = r.corpo;
    let rodadas = 0;
    while (p.status === 'JOGANDO') {
      const b = await ana.post(`/bafo/${p.id}/bater`, { precisao: 0.8 });
      expect(b.status).toBe(200);
      p = b.corpo;
      rodadas++;
    }
    expect(rodadas).toBeLessThanOrEqual(3);
    expect(p.status).toBe('FINALIZADA');
    expect(p.batidas.filter((x: { minha: boolean }) => x.minha).length).toBe(rodadas);
    expect(p.monte.every((c: { codigo: string | null }) => c.codigo)).toBe(true);
    // O que recebeu = as que virou + as suas que ninguém virou.
    const esperado = p.monte
      .filter((c: { virou: string | null; minha: boolean }) => c.virou === 'EU' || (c.virou === null && c.minha))
      .map((c: { codigo: string }) => c.codigo)
      .sort();
    expect([...p.recebi].sort()).toEqual(esperado);
    expect(total(await quantidades('ana'))).toBe(2 + p.recebi.length);
  });

  it('só aceita repetidas e de 1 a 3 figurinhas', async () => {
    await definir('ana', { 'UNI-05': 1, 'TUB-07': 2 });
    expect((await ana.post('/bafo/computador', { figurinhas: ['UNI-05'] })).corpo.codigo).toBe('SEM_REPETIDA');
    expect((await ana.post('/bafo/computador', { figurinhas: ['TUB-07', 'TUB-07'] })).corpo.codigo).toBe('SEM_REPETIDA');
    expect((await ana.post('/bafo/computador', { figurinhas: [] })).status).toBe(400);
    expect((await ana.post('/bafo/computador', { figurinhas: ['A', 'B', 'C', 'D'] })).status).toBe(400);
    expect(await quantidades('ana')).toEqual({ 'UNI-05': 1, 'TUB-07': 2 });
  });

  it('entre amigos: desafio, aceite com a mesma quantidade, vez de cada um e cartas que trocam de dono', async () => {
    await definir('ana', { 'UNI-05': 3 });
    await definir('bia', { 'SER-04': 3 });
    const d = await ana.post('/bafo/desafios', { adversarioId: j.bia.id, figurinhas: ['UNI-05', 'UNI-05'] });
    expect(d.status).toBe(201);
    expect(d.corpo.status).toBe('CONVITE');
    expect(await quantidades('ana')).toEqual({ 'UNI-05': 1 });

    const lista = await bia.get('/bafo');
    expect(lista.corpo.convitesRecebidos).toHaveLength(1);
    expect(lista.corpo.convitesRecebidos[0].cartasDesafiante).toEqual(['UNI-05', 'UNI-05']);
    expect((await bia.post(`/bafo/${d.corpo.id}/aceitar`, { figurinhas: ['SER-04'] })).corpo.codigo).toBe('BAFO_INVALIDO');
    expect((await ana.post(`/bafo/${d.corpo.id}/aceitar`, { figurinhas: ['UNI-05', 'UNI-05'] })).status).toBe(403);
    expect((await caio.get(`/bafo/${d.corpo.id}`)).status).toBe(404);

    expect((await bia.get('/eu')).corpo.pendencias.bafo).toBe(1);
    const a = await bia.post(`/bafo/${d.corpo.id}/aceitar`, { figurinhas: ['SER-04', 'SER-04'] });
    expect(a.status).toBe(200);
    expect(a.corpo).toMatchObject({ status: 'JOGANDO', minhaVez: false });
    expect((await bia.post(`/bafo/${d.corpo.id}/bater`, { precisao: 1 })).corpo.codigo).toBe('BAFO_INVALIDO');
    expect((await bia.get('/eu')).corpo.pendencias.bafo).toBe(0);
    expect((await ana.get('/eu')).corpo.pendencias.bafo).toBe(1);

    const antes = total(await quantidades('ana')) + total(await quantidades('bia'));
    let p = (await ana.get(`/bafo/${d.corpo.id}`)).corpo;
    while (p.status === 'JOGANDO') {
      const quem = p.minhaVez ? ana : bia;
      const r = await quem.post(`/bafo/${p.id}/bater`, { precisao: 0.7 });
      expect(r.status).toBe(200);
      p = (await ana.get(`/bafo/${p.id}`)).corpo;
    }
    expect(p.status).toBe('FINALIZADA');
    // Nenhuma figurinha some nem aparece entre os dois.
    expect(total(await quantidades('ana')) + total(await quantidades('bia'))).toBe(antes + 4);
    const daBia = (await bia.get(`/bafo/${p.id}`)).corpo;
    expect(daBia.recebi.length + p.recebi.length).toBe(4);
    expect(daBia.placar).toEqual({ eu: p.placar.adversario, adversario: p.placar.eu });
  });

  it('recusar, cancelar e expirar devolvem as figurinhas do desafiante', async () => {
    await definir('ana', { 'UNI-05': 4 });
    const d1 = await ana.post('/bafo/desafios', { adversarioId: j.bia.id, figurinhas: ['UNI-05'] });
    expect((await bia.post(`/bafo/${d1.corpo.id}/recusar`)).corpo.status).toBe('RECUSADA');
    const d2 = await ana.post('/bafo/desafios', { adversarioId: j.bia.id, figurinhas: ['UNI-05'] });
    expect((await bia.post(`/bafo/${d2.corpo.id}/cancelar`)).status).toBe(403);
    expect((await ana.post(`/bafo/${d2.corpo.id}/cancelar`)).corpo.status).toBe('CANCELADA');
    const d3 = await ana.post('/bafo/desafios', { adversarioId: j.bia.id, figurinhas: ['UNI-05', 'UNI-05'] });
    expect(await quantidades('ana')).toEqual({ 'UNI-05': 2 });
    await prisma.bafo.update({ where: { id: d3.corpo.id }, data: { expiraEm: new Date(Date.now() - 1000) } });
    expect((await ana.get(`/bafo/${d3.corpo.id}`)).corpo.status).toBe('EXPIRADA');
    expect(await quantidades('ana')).toEqual({ 'UNI-05': 4 });
  });

  it('só desafia amigos e respeita o limite diário de partidas', async () => {
    await definir('ana', { 'UNI-05': 3 });
    expect((await ana.post('/bafo/desafios', { adversarioId: j.caio.id, figurinhas: ['UNI-05'] })).corpo.codigo).toBe('SO_ENTRE_AMIGOS');
    const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    await prisma.bafo.createMany({
      data: Array.from({ length: BAFO.partidasPorDia }, () => ({
        desafianteId: j.ana.id,
        contraComputador: true,
        status: 'FINALIZADA' as const,
        quantidade: 1,
        cartasA: ['UNI-05'],
        dia,
        expiraEm: new Date(),
      })),
    });
    const r = await ana.post('/bafo/computador', { figurinhas: ['UNI-05'] });
    expect(r.status).toBe(409);
    expect(r.corpo.codigo).toBe('LIMITE_BAFO_DIA');
    expect((await ana.get('/bafo')).corpo).toMatchObject({ limiteDia: BAFO.partidasPorDia, jogadasHoje: BAFO.partidasPorDia });
    expect(await quantidades('ana')).toEqual({ 'UNI-05': 3 });
  });

  it('partida contra o computador abandonada termina como está e devolve o que não virou', async () => {
    await definir('ana', { 'UNI-05': 3 });
    const r = await ana.post('/bafo/computador', { figurinhas: ['UNI-05', 'UNI-05'] });
    await prisma.bafo.update({ where: { id: r.corpo.id }, data: { expiraEm: new Date(Date.now() - 1000) } });
    const p = (await ana.get(`/bafo/${r.corpo.id}`)).corpo;
    expect(p.status).toBe('EXPIRADA');
    expect(p.recebi).toEqual(['UNI-05', 'UNI-05']);
    expect(await quantidades('ana')).toEqual({ 'UNI-05': 3 });
  });

  it('se o adversário exclui a conta no meio do jogo, as figurinhas que não viraram voltam', async () => {
    await definir('ana', { 'UNI-05': 3 });
    await definir('bia', { 'SER-04': 3 });
    const d = await ana.post('/bafo/desafios', { adversarioId: j.bia.id, figurinhas: ['UNI-05', 'UNI-05'] });
    await bia.post(`/bafo/${d.corpo.id}/aceitar`, { figurinhas: ['SER-04', 'SER-04'] });
    const p = (await ana.post(`/bafo/${d.corpo.id}/bater`, { precisao: 0 })).corpo;
    const minhasQueViraram = p.monte.filter((c: { minha: boolean; virou: string | null }) => c.minha && c.virou !== null).length;
    const ganhei = p.placar.eu;
    expect((await bia.post('/auth/excluir-conta', { senha: 'senha-forte-123' })).status).toBe(200);
    // Fica com: a cópia que não apostou + as suas que ninguém virou + todas as que ela virou.
    expect(total(await quantidades('ana'))).toBe(1 + 2 - minhasQueViraram + ganhei);
  });
});
