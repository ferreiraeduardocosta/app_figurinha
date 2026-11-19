/**
 * Ferramentas da fase de testes do painel: reiniciar a liga e zerar figurinhas.
 * Precisa de DATABASE_URL (banco migrado e com seed); sem ela, é pulado.
 * Os arquivos de teste rodam um por vez (vitest.config.ts), então zerar o banco aqui
 * não atrapalha os outros.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { CONFIG_LIGA, LigaService } from '../src/liga/liga.service';
import { PrismaService } from '../src/prisma/prisma.service';

const temBanco = !!process.env.DATABASE_URL;

describe.skipIf(!temBanco)('Painel: fase de testes', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let base: string;
  const sufixo = String(Date.now()).slice(-8);
  const contas: Record<'admin' | 'jogador', { id: string; token: string }> = {} as never;

  const chamar = async (metodo: string, rota: string, token: string, corpo?: unknown) => {
    const r = await fetch(base + rota, {
      method: metodo,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const texto = await r.text();
    return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
  };

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    for (const nome of ['admin', 'jogador'] as const) {
      const r = await chamar('POST', '/auth/cadastro', '', {
        apelido: `t${nome}_${sufixo}`,
        email: `testes-e2e-${nome}-${sufixo}@exemplo.com`,
        senha: 'senha-forte-123',
      });
      contas[nome] = { id: r.corpo.usuario.id, token: r.corpo.token };
    }
    await prisma.usuario.update({ where: { id: contas.admin.id }, data: { papel: 'ADMIN' } });
  });

  afterAll(async () => {
    // Devolve a liga à agenda padrão do liga.json para os outros testes.
    await prisma.configuracaoLiga.deleteMany({ where: { temporada: CONFIG_LIGA.temporada } });
    await prisma.partida.deleteMany({ where: { temporada: CONFIG_LIGA.temporada } });
    await app.get(LigaService).agenda();
    await prisma.usuario.deleteMany({ where: { email: { startsWith: 'testes-e2e-' } } });
    await app.close();
  });

  it('só administradores usam', async () => {
    expect((await chamar('GET', '/admin/testes', contas.jogador.token)).status).toBe(403);
    expect((await chamar('POST', '/admin/testes/zerar-progresso', contas.jogador.token, { confirmacao: 'ZERAR' })).status).toBe(403);
  });

  it('reinicia a liga na rodada 1 com a data e o intervalo escolhidos', async () => {
    const antes = (await chamar('GET', '/admin/testes', contas.admin.token)).corpo.liga;
    // Início 3 horas atrás, uma rodada por hora: as rodadas 1 a 4 já devem ter sido disputadas.
    const tresHorasAtras = new Date(Date.now() - 3 * 60 * 60 * 1000 - 60_000);
    const local = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
      .format(tresHorasAtras)
      .replace(' ', 'T');
    const r = await chamar('POST', '/admin/testes/liga', contas.admin.token, { primeiraRodada: local, intervalo: 1, unidade: 'horas' });
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({ intervaloMinutos: 60, versao: antes.versao + 1, totalRodadas: 14, rodadasDisputadas: 4 });
    expect(r.corpo.proximaRodada.numero).toBe(5);

    const painel = await fetch(base + '/liga').then((x) => x.json());
    expect(painel.ultimaRodada).toBe(4);
    expect(painel.proximaRodada.numero).toBe(5);

    // Data no futuro: nenhuma rodada disputada.
    const futuro = await chamar('POST', '/admin/testes/liga', contas.admin.token, { primeiraRodada: '2099-01-01T18:00', intervalo: 7, unidade: 'dias' });
    expect(futuro.corpo).toMatchObject({ rodadasDisputadas: 0, intervaloMinutos: 7 * 24 * 60 });
    expect((await fetch(base + '/liga').then((x) => x.json())).ultimaRodada).toBe(0);
  });

  it('recusa data ou intervalo inválidos', async () => {
    const t = contas.admin.token;
    expect((await chamar('POST', '/admin/testes/liga', t, { primeiraRodada: 'amanhã', intervalo: 1, unidade: 'dias' })).status).toBe(400);
    expect((await chamar('POST', '/admin/testes/liga', t, { primeiraRodada: '2099-01-01T18:00', intervalo: 2, unidade: 'minutos' })).status).toBe(400);
    expect((await chamar('POST', '/admin/testes/liga', t, { primeiraRodada: '2099-01-01T18:00', intervalo: 1, unidade: 'semanas' })).status).toBe(400);
  });

  it('zera as figurinhas de todos sem apagar contas', async () => {
    await prisma.itemAlbum.createMany({
      data: [
        { usuarioId: contas.jogador.id, figurinhaCodigo: 'TUB-04', quantidade: 3 },
        { usuarioId: contas.admin.id, figurinhaCodigo: 'UNI-05', quantidade: 1 },
      ],
    });
    await prisma.usuario.update({ where: { id: contas.jogador.id }, data: { moedas: 50, pacotesBonus: 2 } });
    const contasAntes = await prisma.usuario.count();

    expect((await chamar('POST', '/admin/testes/zerar-progresso', contas.admin.token, { confirmacao: 'zerar' })).status).toBe(400);
    const r = await chamar('POST', '/admin/testes/zerar-progresso', contas.admin.token, { confirmacao: 'ZERAR' });
    expect(r.status).toBe(200);
    expect(r.corpo.figurinhas).toBeGreaterThanOrEqual(2);

    expect(await prisma.itemAlbum.count()).toBe(0);
    expect(await prisma.usuario.count()).toBe(contasAntes);
    expect(await prisma.usuario.findUnique({ where: { id: contas.jogador.id } })).toMatchObject({ moedas: 0, pacotesBonus: 0 });
    // A conta continua funcionando com o mesmo login.
    expect((await chamar('GET', '/eu', contas.jogador.token)).corpo.album.coladas).toBe(0);
  });
});
