/**
 * Painel de administração, de ponta a ponta, com PostgreSQL de verdade.
 * Precisa de DATABASE_URL (banco migrado e com seed); sem ela, é pulado.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar';
import { PrismaService } from '../src/prisma/prisma.service';

const temBanco = !!process.env.DATABASE_URL;

describe.skipIf(!temBanco)('Painel de administração', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let base: string;
  let tokenAdmin = '';
  let tokenJogador = '';
  let adminId = '';
  const sufixo = String(Date.now()).slice(-8); // apelidos têm no máximo 20 caracteres
  let original: { apelido: string | null; destaque: string | null };

  const chamar = async (metodo: string, rota: string, token: string, corpo?: unknown) => {
    const r = await fetch(base + rota, {
      method: metodo,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const texto = await r.text();
    let dados: any = null;
    try {
      dados = texto ? JSON.parse(texto) : null;
    } catch {
      dados = texto;
    }
    return { status: r.status, corpo: dados, cabecalhos: r.headers };
  };

  const cadastrar = async (nome: string) => {
    const r = await chamar('POST', '/auth/cadastro', '', {
      apelido: `${nome}_${sufixo}`,
      email: `adm-e2e-${nome}-${sufixo}@exemplo.com`,
      senha: 'senha-forte-123',
    });
    return r.corpo as { token: string; usuario: { id: string } };
  };

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configurarApp(app);
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);

    const admin = await cadastrar('admin');
    adminId = admin.usuario.id;
    await prisma.usuario.update({ where: { id: adminId }, data: { papel: 'ADMIN' } });
    // O papel é lido do banco a cada pedido, então o token de antes da promoção já vale como admin.
    tokenAdmin = admin.token;
    tokenJogador = (await cadastrar('jogador')).token;
    original = await prisma.figurinha.findUniqueOrThrow({ where: { codigo: 'UNI-11' }, select: { apelido: true, destaque: true } });
  });

  afterAll(async () => {
    await prisma.figurinha.update({ where: { codigo: 'UNI-11' }, data: original });
    await prisma.itemAlbum.deleteMany({ where: { figurinhaCodigo: { in: ['UNI-16', 'UNI-17'] } } });
    await prisma.figurinha.deleteMany({ where: { codigo: { in: ['UNI-16', 'UNI-17'] } } });
    await prisma.alteracaoAdmin.deleteMany({ where: { adminId } });
    await prisma.usuario.deleteMany({ where: { email: { startsWith: 'adm-e2e-' } } });
    await app.close();
  });

  it('bloqueia quem não é admin', async () => {
    expect((await chamar('GET', '/admin/resumo', '')).status).toBe(401);
    const r = await chamar('GET', '/admin/resumo', tokenJogador);
    expect(r.status).toBe(403);
    expect(r.corpo.codigo).toBe('SO_ADMIN');
    expect((await chamar('PATCH', '/admin/figurinhas/UNI-11', tokenJogador, { apelido: 'hack' })).status).toBe(403);
  });

  it('mostra o resumo e a conferência do sorteio', async () => {
    const r = await chamar('GET', '/admin/resumo', tokenAdmin);
    expect(r.status).toBe(200);
    expect(r.corpo.figurinhasNoCatalogo).toBe(136);
    expect(r.corpo.sorteio.porRaridade.map((x: { raridade: string }) => x.raridade)).toEqual(['COMUM', 'RARA', 'EPICA', 'LENDARIA']);
    expect(r.corpo.sorteio.porRaridade[3].esperado).toBe(0.03);
  });

  it('lista as figurinhas com o número de donos', async () => {
    const r = await chamar('GET', '/admin/figurinhas', tokenAdmin);
    expect(r.corpo).toHaveLength(136);
    expect(r.corpo[0]).toMatchObject({ codigo: 'TUB-01', donos: expect.any(Number) });
  });

  it('edita uma figurinha e registra quem mudou o quê', async () => {
    const r = await chamar('PATCH', '/admin/figurinhas/uni-11', tokenAdmin, { apelido: 'Faísca de Teste', destaque: 'Teste' });
    expect(r.status).toBe(200);
    expect(r.corpo.apelido).toBe('Faísca de Teste');

    const log = await chamar('GET', '/admin/alteracoes', tokenAdmin);
    const minha = log.corpo.find((a: { adminId: string }) => a.adminId === adminId);
    expect(minha).toMatchObject({
      acao: 'EDITAR',
      figurinhaCodigo: 'UNI-11',
      antes: { apelido: original.apelido, destaque: original.destaque },
      depois: { apelido: 'Faísca de Teste', destaque: 'Teste' },
    });
  });

  it('valida os dados da edição', async () => {
    const erro = async (corpo: unknown) => (await chamar('PATCH', '/admin/figurinhas/UNI-11', tokenAdmin, corpo)).corpo;
    expect((await erro({ raridade: 'MITICA' })).campo).toBe('raridade');
    expect((await erro({ ataque: 90, defesa: 80 })).campo).toBe('atributos');
    expect((await erro({ ataque: 120, defesa: 80, tecnica: 70, velocidade: 60, fisico: 50 })).campo).toBe('ataque');
    expect((await erro({ codigo: 'XXX-01' })).campo).toBe('codigo');
    expect((await erro({ historia: '' })).campo).toBe('historia');
    expect((await chamar('PATCH', '/admin/figurinhas/ZZZ-99', tokenAdmin, { nome: 'x' })).status).toBe(404);
  });

  it('cria e exclui figurinha, e não exclui figurinha que alguém já tem', async () => {
    const nova = {
      codigo: 'UNI-16', numero: 9001, secao: 'Unidos da Várzea', clubeSigla: 'UNI', nome: 'Reforço de Teste',
      tipo: 'JOGADOR', raridade: 'RARA', posicao: 'ATA', camisa: 99,
      ataque: 70, defesa: 40, tecnica: 60, velocidade: 65, fisico: 60,
      historia: 'Criado pelo teste.', descricaoVisual: 'Silhueta.',
    };
    const criada = await chamar('POST', '/admin/figurinhas', tokenAdmin, nova);
    expect(criada.status).toBe(201);
    expect((await chamar('POST', '/admin/figurinhas', tokenAdmin, nova)).corpo.codigo).toBe('JA_EXISTE');
    expect((await chamar('POST', '/admin/figurinhas', tokenAdmin, { ...nova, codigo: 'UNI-18', numero: 9003, clubeSigla: 'XYZ' })).corpo.codigo)
      .toBe('CLUBE_INEXISTENTE');
    expect((await chamar('DELETE', '/admin/figurinhas/UNI-16', tokenAdmin)).status).toBe(204);

    await chamar('POST', '/admin/figurinhas', tokenAdmin, { ...nova, codigo: 'UNI-17', numero: 9002 });
    await prisma.itemAlbum.create({ data: { usuarioId: adminId, figurinhaCodigo: 'UNI-17', quantidade: 1 } });
    const bloqueada = await chamar('DELETE', '/admin/figurinhas/UNI-17', tokenAdmin);
    expect(bloqueada.status).toBe(409);
    expect(bloqueada.corpo.codigo).toBe('FIGURINHA_EM_USO');
  });

  it('busca usuários', async () => {
    const r = await chamar('GET', `/admin/usuarios?busca=jogador_${sufixo}`, tokenAdmin);
    expect(r.corpo).toHaveLength(1);
    expect(r.corpo[0]).toMatchObject({ papel: 'JOGADOR', coladas: 0 });
    expect(r.corpo[0].senhaHash).toBeUndefined();
  });

  it('serve a página do painel com cabeçalhos de segurança', async () => {
    const r = await fetch(base + '/admin/');
    expect(r.status).toBe(200);
    expect(await r.text()).toContain('<title>Painel Liga Aurora</title>');
    expect(r.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect(r.headers.get('x-frame-options')).toBe('DENY');
  });
});
