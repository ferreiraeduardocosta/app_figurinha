/**
 * Ranking de colecionadores, com PostgreSQL de verdade.
 * Precisa de DATABASE_URL (banco migrado e com seed); sem ela, é pulado.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

type Nome = 'ana' | 'bia' | 'caio' | 'duda' | 'edu' | 'fabi';

describe.skipIf(!process.env.DATABASE_URL)('Ranking', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let base: string;
  const sufixo = String(Date.now()).slice(-7);
  const j = {} as Record<Nome, { id: string; token: string; apelido: string }>;

  const ranking = async (quem: Nome, escopo = 'geral') => {
    const r = await fetch(`${base}/ranking?escopo=${escopo}`, { headers: { authorization: `Bearer ${j[quem].token}` } });
    return r.json();
  };
  /** Cola `n` figurinhas Comuns (e `lendarias` Lendárias), todas em `quando`. */
  const colar = async (quem: Nome, n: number, lendarias: number, quando: Date) => {
    const comuns = await prisma.figurinha.findMany({ where: { raridade: 'COMUM' }, take: n, orderBy: { numero: 'asc' } });
    const lend = await prisma.figurinha.findMany({ where: { raridade: 'LENDARIA' }, take: lendarias, orderBy: { numero: 'asc' } });
    await prisma.itemAlbum.createMany({
      data: [...comuns, ...lend].map((f) => ({ usuarioId: j[quem].id, figurinhaCodigo: f.codigo, quantidade: 1, primeiraEm: quando })),
    });
  };

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    for (const nome of ['ana', 'bia', 'caio', 'duda', 'edu', 'fabi'] as Nome[]) {
      const apelido = `rk${nome}_${sufixo}`;
      const r = await fetch(base + '/auth/cadastro', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apelido, email: `rank-e2e-${nome}-${sufixo}@exemplo.com`, senha: 'senha-forte-123' }),
      }).then((x) => x.json());
      j[nome] = { id: r.usuario.id, token: r.token, apelido };
    }
    const cedo = new Date('2026-01-01T00:00:00Z');
    const tarde = new Date('2026-06-01T00:00:00Z');
    await colar('ana', 9, 1, tarde); // 10 coladas, 1 Lendária
    await colar('bia', 10, 0, cedo); // 10 coladas, 0 Lendária
    await colar('fabi', 10, 0, tarde); // 10 coladas, 0 Lendária, chegou depois da Bia
    await colar('caio', 12, 0, tarde); // 12 coladas
    await colar('edu', 20, 0, cedo); // conta excluída: não aparece
    await prisma.usuario.update({ where: { id: j.edu.id }, data: { excluidoEm: new Date() } });
    // Ana e Bia são amigas.
    await prisma.amizade.create({ data: { solicitanteId: j.ana.id, destinatarioId: j.bia.id, status: 'ACEITA', aceitaEm: new Date() } });
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { startsWith: 'rank-e2e-' } } });
    await app.close();
  });

  it('geral: mais coladas na frente; desempate pelas Lendárias e por quem chegou antes', async () => {
    const r = await ranking('ana');
    const meus = r.lista.filter((l: { apelido: string }) => l.apelido.endsWith(sufixo)).map((l: { apelido: string }) => l.apelido);
    expect(meus).toEqual([j.caio.apelido, j.ana.apelido, j.bia.apelido, j.fabi.apelido]);
    expect(r.eu).toMatchObject({ apelido: j.ana.apelido, coladas: 10, lendarias: 1, souEu: true });
    const pos = (n: Nome) => r.lista.find((l: { apelido: string }) => l.apelido === j[n].apelido).posicao;
    expect(pos('caio')).toBeLessThan(pos('ana'));
    expect(pos('ana')).toBeLessThan(pos('bia'));
    expect(pos('bia')).toBeLessThan(pos('fabi'));
  });

  it('contas excluídas e quem não colou nada ficam de fora', async () => {
    const r = await ranking('duda');
    expect(r.lista.some((l: { apelido: string }) => l.apelido === j.edu.apelido)).toBe(false);
    expect(r.lista.some((l: { apelido: string }) => l.apelido === j.duda.apelido)).toBe(false);
    expect(r.eu).toBeNull();
    expect(r.lista.every((l: { coladas: number }) => l.coladas > 0)).toBe(true);
  });

  it('amigos: só o jogador e os amigos dele', async () => {
    const r = await ranking('ana', 'amigos');
    expect(r.participantes).toBe(2);
    expect(r.lista.map((l: { apelido: string; posicao: number }) => [l.posicao, l.apelido])).toEqual([
      [1, j.ana.apelido],
      [2, j.bia.apelido],
    ]);
    const sozinho = await ranking('caio', 'amigos');
    expect(sozinho.lista).toHaveLength(1);
    expect(sozinho.eu.posicao).toBe(1);
  });

  it('não expõe e-mail nem id', async () => {
    const r = await ranking('ana');
    for (const l of r.lista) expect(Object.keys(l).sort()).toEqual(['apelido', 'campeao', 'coladas', 'lendarias', 'posicao', 'souEu']);
  });
});
