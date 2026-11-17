/**
 * Teste de ponta a ponta das rotas HTTP, com PostgreSQL de verdade.
 * Precisa de DATABASE_URL (banco migrado e com seed); sem ela, é pulado.
 */
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const temBanco = !!process.env.DATABASE_URL;

describe.skipIf(!temBanco)('API (ponta a ponta)', () => {
  let app: INestApplication;
  let base: string;
  const sufixo = `${Date.now()}`;
  const conta = { apelido: `e2e_${sufixo}`, email: `e2e-${sufixo}@exemplo.com`, senha: 'senha-forte-123' };
  let token = '';

  const chamar = async (metodo: string, rota: string, corpo?: unknown, tk = token) => {
    const r = await fetch(base + rota, {
      method: metodo,
      headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const texto = await r.text();
    return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
  };

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    await app.listen(0);
    base = await app.getUrl();
    base = base.replace('[::1]', 'localhost');
  });

  afterAll(async () => {
    await app.get(PrismaService).usuario.deleteMany({ where: { email: { startsWith: 'e2e-' } } });
    await app.close();
  });

  it('cadastra, recusa duplicado e valida a entrada', async () => {
    const r = await chamar('POST', '/auth/cadastro', conta, '');
    expect(r.status).toBe(201);
    expect(r.corpo.token).toMatch(/^[\w-]{43}$/);
    token = r.corpo.token;

    expect((await chamar('POST', '/auth/cadastro', conta, '')).corpo.codigo).toBe('JA_CADASTRADO');
    const ruim = await chamar('POST', '/auth/cadastro', { ...conta, email: 'nao-e-email', apelido: 'outro_' + sufixo }, '');
    expect(ruim.status).toBe(400);
    expect(ruim.corpo.campo).toBe('email');
  });

  it('entra com a senha certa e recusa a errada', async () => {
    expect((await chamar('POST', '/auth/entrar', { email: conta.email, senha: 'errada-123' }, '')).status).toBe(401);
    const ok = await chamar('POST', '/auth/entrar', { email: conta.email.toUpperCase(), senha: conta.senha }, '');
    expect(ok.status).toBe(200);
    expect(ok.corpo.usuario.apelido).toBe(conta.apelido);
  });

  it('exige login nas rotas do jogador', async () => {
    expect((await chamar('GET', '/eu', undefined, '')).status).toBe(401);
    expect((await chamar('GET', '/eu', undefined, 'token-falso')).status).toBe(401);
  });

  it('abre o pacote diário uma vez e mostra no álbum', async () => {
    const antes = await chamar('GET', '/eu');
    expect(antes.corpo.pacoteDiario.disponivel).toBe(true);
    expect(antes.corpo.album).toEqual({ coladas: 0, total: 136 });

    const pacote = await chamar('POST', '/pacotes/diario');
    expect(pacote.status).toBe(200);
    expect(pacote.corpo.figurinhas).toHaveLength(5);
    expect(pacote.corpo.figurinhas.some((f: { nova: boolean }) => f.nova)).toBe(true);

    const denovo = await chamar('POST', '/pacotes/diario');
    expect(denovo.status).toBe(409);
    expect(denovo.corpo.codigo).toBe('PACOTE_DIARIO_JA_ABERTO');

    const album = await chamar('GET', '/album');
    const total = album.corpo.itens.reduce((s: number, i: { quantidade: number }) => s + i.quantidade, 0);
    expect(total).toBe(5);
    const depois = await chamar('GET', '/eu');
    expect(depois.corpo.pacoteDiario.disponivel).toBe(false);
    expect(depois.corpo.album.coladas).toBe(album.corpo.itens.length);
  });

  it('recusa balcão sem repetidas suficientes e código inválido', async () => {
    expect((await chamar('POST', '/balcao', { codigo: 'LEN-01' })).corpo.codigo).toBe('REPETIDAS_INSUFICIENTES');
    expect((await chamar('POST', '/balcao', { codigo: 'drop table' })).status).toBe(400);
  });

  it('sai e o token deixa de valer', async () => {
    expect((await chamar('POST', '/auth/sair')).status).toBe(204);
    expect((await chamar('GET', '/eu')).status).toBe(401);
  });
});
