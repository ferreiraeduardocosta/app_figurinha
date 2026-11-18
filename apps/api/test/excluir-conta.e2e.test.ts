/**
 * Exclusão de conta (LGPD), de ponta a ponta, com PostgreSQL de verdade.
 * Precisa de DATABASE_URL (banco migrado e com seed); sem ela, é pulado.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe.skipIf(!process.env.DATABASE_URL)('Exclusão de conta', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let base: string;
  const sufixo = String(Date.now()).slice(-8);
  const SENHA = 'senha-forte-123';
  const idsCriados: string[] = [];

  const chamar = async (metodo: string, rota: string, token: string | null, corpo?: unknown) => {
    const r = await fetch(base + rota, {
      method: metodo,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const texto = await r.text();
    return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
  };
  const cadastrar = async (nome: string) => {
    const r = await chamar('POST', '/auth/cadastro', null, { apelido: `${nome}_${sufixo}`, email: `excl-${nome}-${sufixo}@exemplo.com`, senha: SENHA });
    idsCriados.push(r.corpo.usuario.id);
    return { id: r.corpo.usuario.id as string, token: r.corpo.token as string, apelido: `${nome}_${sufixo}`, email: `excl-${nome}-${sufixo}@exemplo.com` };
  };

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.compra.deleteMany({ where: { usuarioId: { in: idsCriados } } });
    await prisma.usuario.deleteMany({ where: { OR: [{ id: { in: idsCriados } }, { email: { startsWith: 'excl-' } }] } });
    await app.close();
  });

  it('exige a senha correta', async () => {
    const u = await cadastrar('senha');
    const r = await chamar('POST', '/auth/excluir-conta', u.token, { senha: 'senha-errada-1' });
    expect(r.status).toBe(403);
    expect(r.corpo.codigo).toBe('SENHA_INCORRETA');
    expect((await chamar('GET', '/eu', u.token)).status).toBe(200);
  });

  it('conta sem compras é apagada por inteiro, com álbum, amizades e trocas', async () => {
    const u = await cadastrar('semcompra');
    const amigo = await cadastrar('amigo');
    await chamar('POST', '/pacotes/diario', u.token);
    await chamar('POST', '/amigos', u.token, { apelido: amigo.apelido });
    await chamar('GET', '/missoes', u.token);

    const r = await chamar('POST', '/auth/excluir-conta', u.token, { senha: SENHA });
    expect(r.corpo.resultado).toBe('APAGADA');
    expect(await prisma.usuario.count({ where: { id: u.id } })).toBe(0);
    expect(await prisma.itemAlbum.count({ where: { usuarioId: u.id } })).toBe(0);
    expect(await prisma.amizade.count({ where: { OR: [{ solicitanteId: u.id }, { destinatarioId: u.id }] } })).toBe(0);
    expect((await chamar('GET', '/eu', u.token)).status).toBe(401);
    // E-mail e apelido ficam livres.
    const de_novo = await chamar('POST', '/auth/cadastro', null, { apelido: u.apelido, email: u.email, senha: SENHA });
    expect(de_novo.status).toBe(201);
    idsCriados.push(de_novo.corpo.usuario.id);
  });

  it('conta com compras é anonimizada e o registro da compra é guardado', async () => {
    const u = await cadastrar('comcompra');
    await prisma.compra.create({
      data: {
        usuarioId: u.id,
        produtoId: 'pacote_6',
        loja: 'PLAY_STORE',
        ambiente: 'PRODUCTION',
        transacaoId: `GPA.excl-${sufixo}`,
        pacotes: 6,
        moedas: 0,
        valorCentavos: 990,
        moeda: 'BRL',
      },
    });
    await prisma.usuario.update({ where: { id: u.id }, data: { pacotesComprados: 6, dataNascimento: new Date('1990-01-01') } });
    await chamar('POST', '/pacotes/diario', u.token);

    const r = await chamar('POST', '/auth/excluir-conta', u.token, { senha: SENHA });
    expect(r.corpo.resultado).toBe('ANONIMIZADA');
    const anon = await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } });
    expect(anon.apelido).toMatch(/^excluido_/);
    expect(anon.email).toMatch(/@excluido\.invalid$/);
    expect(anon).toMatchObject({ dataNascimento: null, pacotesComprados: 0, moedas: 0 });
    expect(anon.excluidoEm).not.toBeNull();
    expect(await prisma.itemAlbum.count({ where: { usuarioId: u.id } })).toBe(0);
    expect(await prisma.sessao.count({ where: { usuarioId: u.id } })).toBe(0);
    expect(await prisma.compra.count({ where: { usuarioId: u.id } })).toBe(1);

    expect((await chamar('GET', '/eu', u.token)).status).toBe(401);
    expect((await chamar('POST', '/auth/entrar', null, { email: u.email, senha: SENHA })).status).toBe(401);
    const de_novo = await chamar('POST', '/auth/cadastro', null, { apelido: u.apelido, email: u.email, senha: SENHA });
    expect(de_novo.status).toBe(201);
    idsCriados.push(de_novo.corpo.usuario.id);
  });
});
