/**
 * Missões diárias: sorteio (sem banco) e fluxo completo (com PostgreSQL, se houver DATABASE_URL).
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { CONFIG_MISSOES, escolherMissoes } from '../src/missoes/missoes';
import { MissoesService } from '../src/missoes/missoes.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('sorteio das missões', () => {
  const tudo = () => true;
  const nada = () => false;

  it('sempre tem 3 missões, com "abrir 1 pacote" e sem tipos repetidos', () => {
    for (let i = 0; i < 200; i++) {
      const m = escolherMissoes(CONFIG_MISSOES, tudo, `jogador-${i}:2026-11-18`);
      expect(m).toHaveLength(3);
      expect(m[0].id).toBe('abrir_1');
      expect(new Set(m.map((x) => x.tipo)).size).toBe(3);
    }
  });

  it('sem amigos não sorteia missão de troca; sem repetidas não sorteia balcão', () => {
    for (let i = 0; i < 200; i++) {
      const ids = escolherMissoes(CONFIG_MISSOES, nada, `j-${i}:2026-11-18`).map((x) => x.id);
      expect(ids).not.toContain('propor_1');
      expect(ids).not.toContain('troca_1');
      expect(ids).not.toContain('balcao_1');
    }
  });

  it('é estável no mesmo dia e varia entre jogadores e dias', () => {
    const a = escolherMissoes(CONFIG_MISSOES, tudo, 'ana:2026-11-18').map((x) => x.id);
    expect(escolherMissoes(CONFIG_MISSOES, tudo, 'ana:2026-11-18').map((x) => x.id)).toEqual(a);
    const combinacoes = new Set(
      Array.from({ length: 50 }, (_, i) => escolherMissoes(CONFIG_MISSOES, tudo, `ana:dia-${i}`).map((x) => x.id).join(',')),
    );
    expect(combinacoes.size).toBeGreaterThan(5);
  });

  it('dá cerca de 60 moedas por dia em média, quando dá para cumprir tudo', () => {
    let total = 0;
    for (let i = 0; i < 1000; i++) total += escolherMissoes(CONFIG_MISSOES, tudo, `m-${i}`).reduce((s, x) => s + x.recompensa, 0);
    expect(total / 1000).toBeGreaterThan(55);
    expect(total / 1000).toBeLessThan(66);
  });
});

describe.skipIf(!process.env.DATABASE_URL)('missões de ponta a ponta', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let base: string;
  let token = '';
  let usuarioId = '';
  const sufixo = String(Date.now()).slice(-8);

  const chamar = async (metodo: string, rota: string) => {
    const r = await fetch(base + rota, { method: metodo, headers: { authorization: `Bearer ${token}` } });
    const texto = await r.text();
    return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
  };

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    const r = await fetch(base + '/auth/cadastro', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apelido: `missao_${sufixo}`, email: `missao-e2e-${sufixo}@exemplo.com`, senha: 'senha-forte-123' }),
    }).then((x) => x.json());
    token = r.token;
    usuarioId = r.usuario.id;
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { startsWith: 'missao-e2e-' } } });
    await app.close();
  });

  it('lista 3 missões cumpríveis para um jogador novo', async () => {
    const r = await chamar('GET', '/missoes');
    expect(r.corpo.missoes).toHaveLength(3);
    expect(r.corpo.missoes[0]).toMatchObject({ id: 'abrir_1', progresso: 0, meta: 1, recompensa: 15, concluida: false });
    const ids = r.corpo.missoes.map((m: { id: string }) => m.id);
    expect(ids).not.toContain('troca_1'); // sem amigos
    expect(ids).not.toContain('balcao_1'); // sem repetidas
    expect((await chamar('GET', '/missoes')).corpo.missoes.map((m: { id: string }) => m.id)).toEqual(ids);
  });

  it('abrir o pacote do dia cumpre a missão; resgate dá moedas uma única vez', async () => {
    expect((await chamar('POST', '/missoes/abrir_1/resgatar')).corpo.codigo).toBe('MISSAO_INCOMPLETA');
    await chamar('POST', '/pacotes/diario');
    const lista = await chamar('GET', '/missoes');
    expect(lista.corpo.missoes[0]).toMatchObject({ progresso: 1, concluida: true, resgatada: false });
    // Um pacote novo tem pelo menos 1 figurinha nova: se "novas_2" foi sorteada, já andou.
    const novas = lista.corpo.missoes.find((m: { id: string }) => m.id === 'novas_2');
    if (novas) expect(novas.progresso).toBeGreaterThan(0);
    expect((await chamar('GET', '/eu')).corpo.pendencias.missoesParaResgatar).toBeGreaterThanOrEqual(1);

    const [r1, r2] = await Promise.all([chamar('POST', '/missoes/abrir_1/resgatar'), chamar('POST', '/missoes/abrir_1/resgatar')]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    const u = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(u.moedas).toBe(15);
    expect((await chamar('POST', '/missoes/abrir_1/resgatar')).corpo.codigo).toBe('MISSAO_JA_RESGATADA');
  });

  it('missão que não é de hoje não pode ser resgatada', async () => {
    const hoje = (await chamar('GET', '/missoes')).corpo.missoes.map((m: { id: string }) => m.id);
    const deOutroDia = CONFIG_MISSOES.pool.find((m) => !hoje.includes(m.id))!.id;
    expect((await chamar('POST', `/missoes/${deOutroDia}/resgatar`)).corpo.codigo).toBe('MISSAO_INEXISTENTE');
    expect((await chamar('POST', '/missoes/DROP%20TABLE/resgatar')).status).toBe(400);
  });

  it('no dia seguinte vêm missões novas, zeradas', async () => {
    const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const r = await app.get(MissoesService).listar(usuarioId, amanha);
    expect(r.missoes.every((m) => m.progresso === 0 && !m.resgatada)).toBe(true);
    expect(r.dia).not.toBe((await chamar('GET', '/missoes')).corpo.dia);
  });
});
