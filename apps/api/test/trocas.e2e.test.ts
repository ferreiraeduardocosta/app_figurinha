/**
 * Amigos e trocas, de ponta a ponta, com PostgreSQL de verdade.
 * Precisa de DATABASE_URL (banco migrado e com seed); sem ela, é pulado.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const temBanco = !!process.env.DATABASE_URL;
const DIA = 24 * 60 * 60 * 1000;

describe.skipIf(!temBanco)('Amigos e trocas', () => {
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
    del: (rota: string) => chamar('DELETE', rota, j[quem].token),
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
      (await prisma.itemAlbum.findMany({ where: { usuarioId: j[quem].id } })).map((i) => [i.figurinhaCodigo, i.quantidade]),
    );
  const propor = (de: typeof ana, para: keyof typeof j, oferta: [string, number][], pedido: [string, number][], respostaA?: string) =>
    de.post('/trocas', {
      paraId: j[para].id,
      oferta: oferta.map(([codigo, quantidade]) => ({ codigo, quantidade })),
      pedido: pedido.map(([codigo, quantidade]) => ({ codigo, quantidade })),
      respostaA,
    });

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    for (const nome of ['ana', 'bia', 'caio'] as const) {
      const apelido = `${nome}_${sufixo}`;
      const r = await fetch(base + '/auth/cadastro', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apelido, email: `troca-e2e-${nome}-${sufixo}@exemplo.com`, senha: 'senha-forte-123' }),
      }).then((x) => x.json());
      j[nome] = { id: r.usuario.id, token: r.token, apelido };
    }
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { startsWith: 'troca-e2e-' } } });
    await app.close();
  });

  it('faz amizade por apelido e recusa pedidos inválidos', async () => {
    const pedido = await ana.post('/amigos', { apelido: j.bia.apelido.toUpperCase() });
    expect(pedido.corpo.status).toBe('PENDENTE');
    expect((await ana.post('/amigos', { apelido: j.bia.apelido })).corpo.codigo).toBe('PEDIDO_JA_ENVIADO');
    expect((await ana.post('/amigos', { apelido: j.ana.apelido })).corpo.codigo).toBe('PEDIDO_PARA_SI');
    expect((await ana.post('/amigos', { apelido: 'ninguem_xyz' })).status).toBe(404);

    const lista = await bia.get('/amigos');
    expect(lista.corpo.recebidos).toHaveLength(1);
    expect((await bia.get('/eu')).corpo.pendencias.pedidosAmizade).toBe(1);
    // Só quem recebeu aceita; quem não faz parte nem enxerga.
    expect((await ana.post(`/amigos/${lista.corpo.recebidos[0].id}/aceitar`)).status).toBe(403);
    expect((await caio.post(`/amigos/${lista.corpo.recebidos[0].id}/aceitar`)).status).toBe(404);
    expect((await bia.post(`/amigos/${lista.corpo.recebidos[0].id}/aceitar`)).corpo.status).toBe('ACEITA');
    expect((await ana.get('/amigos')).corpo.amigos[0].usuario.apelido).toBe(j.bia.apelido);
    expect((await bia.post('/amigos', { apelido: j.ana.apelido })).corpo.codigo).toBe('JA_SAO_AMIGOS');
  });

  it('só troca entre amigos', async () => {
    await definir('ana', { 'UNI-05': 3 });
    await definir('caio', { 'SER-04': 2 });
    const r = await propor(ana, 'caio', [['UNI-05', 1]], [['SER-04', 1]]);
    expect(r.status).toBe(403);
    expect(r.corpo.codigo).toBe('SO_ENTRE_AMIGOS');
  });

  it('propõe, sugere, aceita e move as figurinhas', async () => {
    await definir('ana', { 'UNI-05': 3, 'TUB-05': 1 });
    await definir('bia', { 'SER-04': 2 });

    const sug = await ana.get('/trocas/sugestoes');
    expect(sug.corpo[0]).toMatchObject({ amigo: { apelido: j.bia.apelido }, euRecebo: ['SER-04'], euDou: ['UNI-05'] });

    expect((await propor(ana, 'bia', [['TUB-05', 1]], [['SER-04', 1]])).corpo.codigo).toBe('SEM_REPETIDA');
    const p = await propor(ana, 'bia', [['UNI-05', 1]], [['SER-04', 1]]);
    expect(p.status).toBe(201);
    expect((await bia.get('/eu')).corpo.pendencias.trocasRecebidas).toBe(1);
    expect((await bia.get('/trocas')).corpo.recebidas[0].propostaPor.apelido).toBe(j.ana.apelido);

    expect((await ana.post(`/trocas/${p.corpo.id}/aceitar`)).status).toBe(403);
    const ok = await bia.post(`/trocas/${p.corpo.id}/aceitar`);
    expect(ok.status).toBe(200);
    expect(ok.corpo.novas).toEqual(['UNI-05']);
    expect(Array.isArray(ok.corpo.recompensas)).toBe(true);
    expect(await quantidades('ana')).toEqual({ 'UNI-05': 2, 'TUB-05': 1, 'SER-04': 1 });
    expect(await quantidades('bia')).toEqual({ 'SER-04': 1, 'UNI-05': 1 });
    expect((await bia.post(`/trocas/${p.corpo.id}/aceitar`)).corpo.codigo).toBe('TROCA_ENCERRADA');
  });

  it('encerra a proposta se a repetida foi gasta antes do aceite', async () => {
    await definir('ana', { 'UNI-06': 2 });
    await definir('bia', { 'SER-06': 2 });
    const p = await propor(ana, 'bia', [['UNI-06', 1]], [['SER-06', 1]]);
    await prisma.itemAlbum.update({
      where: { usuarioId_figurinhaCodigo: { usuarioId: j.ana.id, figurinhaCodigo: 'UNI-06' } },
      data: { quantidade: 1 },
    });
    const r = await bia.post(`/trocas/${p.corpo.id}/aceitar`);
    expect(r.status).toBe(409);
    expect(r.corpo.codigo).toBe('TROCA_NAO_E_MAIS_POSSIVEL');
    expect((await prisma.troca.findUniqueOrThrow({ where: { id: p.corpo.id } })).status).toBe('FALHOU');
    expect(await quantidades('bia')).toEqual({ 'SER-06': 2 });
  });

  it('duas trocas que usam a mesma repetida, aceitas ao mesmo tempo: só uma acontece', async () => {
    await definir('ana', { 'UNI-11': 2 });
    await definir('bia', { 'SER-12': 2, 'SER-13': 2 });
    const p1 = await propor(ana, 'bia', [['UNI-11', 1]], [['SER-12', 1]]);
    const p2 = await propor(ana, 'bia', [['UNI-11', 1]], [['SER-13', 1]]);
    const [r1, r2] = await Promise.all([bia.post(`/trocas/${p1.corpo.id}/aceitar`), bia.post(`/trocas/${p2.corpo.id}/aceitar`)]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    expect((await quantidades('ana'))['UNI-11']).toBe(1);
    expect((await quantidades('bia'))['UNI-11']).toBe(1);
  });

  it('contraproposta, recusa e cancelamento', async () => {
    await definir('ana', { 'UNI-07': 2, 'UNI-08': 2 });
    await definir('bia', { 'SER-07': 2, 'SER-08': 2 });
    const original = await propor(ana, 'bia', [['UNI-07', 1]], [['SER-07', 1], ['SER-08', 1]]);
    const contra = await propor(bia, 'ana', [['SER-07', 1]], [['UNI-07', 1]], original.corpo.id);
    expect(contra.status).toBe(201);
    expect(await prisma.troca.findUniqueOrThrow({ where: { id: original.corpo.id } })).toMatchObject({
      status: 'RECUSADA',
      motivo: 'CONTRAPROPOSTA',
    });
    // Não dá para responder de novo à mesma proposta.
    expect((await propor(bia, 'ana', [['SER-08', 1]], [['UNI-08', 1]], original.corpo.id)).corpo.codigo).toBe('CONTRAPROPOSTA_INVALIDA');

    expect((await bia.post(`/trocas/${contra.corpo.id}/cancelar`)).corpo.status).toBe('CANCELADA');
    const outra = await propor(ana, 'bia', [['UNI-08', 1]], [['SER-08', 1]]);
    expect((await ana.post(`/trocas/${outra.corpo.id}/recusar`)).status).toBe(403);
    expect((await bia.post(`/trocas/${outra.corpo.id}/recusar`)).corpo.status).toBe('RECUSADA');
    expect((await caio.post(`/trocas/${outra.corpo.id}/recusar`)).status).toBe(404);
  });

  it('não deixa conta nova trocar Lendária', async () => {
    await definir('ana', { 'LEN-01': 2 });
    await definir('bia', { 'SER-09': 2 });
    const r = await propor(ana, 'bia', [['LEN-01', 1]], [['SER-09', 1]]);
    expect(r.corpo.codigo).toBe('CONTA_NOVA_LENDARIA');
    await prisma.usuario.updateMany({
      where: { id: { in: [j.ana.id, j.bia.id] } },
      data: { criadoEm: new Date(Date.now() - 10 * DIA) },
    });
    expect((await propor(ana, 'bia', [['LEN-01', 1]], [['SER-09', 1]])).status).toBe(201);
  });

  it('respeita o limite diário e a validade das propostas', async () => {
    await definir('ana', { 'UNI-09': 3 });
    await definir('bia', { 'SER-10': 3 });
    const p1 = await propor(ana, 'bia', [['UNI-09', 1]], [['SER-10', 1]]);
    const p2 = await propor(ana, 'bia', [['UNI-09', 1]], [['SER-10', 1]]);

    await prisma.troca.update({ where: { id: p2.corpo.id }, data: { expiraEm: new Date(Date.now() - 1000) } });
    expect((await bia.post(`/trocas/${p2.corpo.id}/aceitar`)).corpo.codigo).toBe('TROCA_EXPIRADA');
    await bia.get('/trocas');
    expect((await prisma.troca.findUniqueOrThrow({ where: { id: p2.corpo.id } })).status).toBe('EXPIRADA');

    await prisma.troca.createMany({
      data: Array.from({ length: 10 }, () => ({
        propostaPorId: j.ana.id,
        paraId: j.bia.id,
        oferta: [],
        pedido: [],
        status: 'ACEITA' as const,
        expiraEm: new Date(),
        respondidaEm: new Date(),
      })),
    });
    expect((await bia.post(`/trocas/${p1.corpo.id}/aceitar`)).corpo.codigo).toBe('LIMITE_TROCAS_DIA');
  });

  it('desfazer a amizade cancela as propostas pendentes', async () => {
    await prisma.troca.deleteMany({ where: { propostaPorId: j.ana.id, status: 'ACEITA' } });
    await definir('ana', { 'UNI-10': 2 });
    await definir('bia', { 'SER-11': 2 });
    const p = await propor(ana, 'bia', [['UNI-10', 1]], [['SER-11', 1]]);
    const amizade = (await ana.get('/amigos')).corpo.amigos[0];
    expect((await ana.del(`/amigos/${amizade.id}`)).status).toBe(204);
    expect(await prisma.troca.findUniqueOrThrow({ where: { id: p.corpo.id } })).toMatchObject({
      status: 'CANCELADA',
      motivo: 'AMIZADE_DESFEITA',
    });
    expect((await ana.get('/amigos')).corpo.amigos).toHaveLength(0);
  });
});
