/**
 * Teste de integração com PostgreSQL de verdade.
 * Precisa de DATABASE_URL apontando para um banco já migrado e com seed;
 * sem ela, o teste é pulado.
 */
import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { rngComSemente } from '@liga-aurora/regras';
import { PacotesService } from '../src/pacotes/pacotes.service';
import { PrismaService } from '../src/prisma/prisma.service';

const temBanco = !!process.env.DATABASE_URL;

describe.skipIf(!temBanco)('PacotesService (integração)', () => {
  const prisma = new PrismaService();
  const servico = new PacotesService(prisma);
  let usuarioId: string;

  beforeAll(async () => {
    await prisma.$connect();
    await servico.onModuleInit();
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { apelido: { startsWith: 'teste-' } } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    servico.rng = rngComSemente(123);
    const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const u = await prisma.usuario.create({
      data: { apelido: `teste-${sufixo}`, email: `teste-${sufixo}@exemplo.com`, senhaHash: 'x' },
    });
    usuarioId = u.id;
  });

  it('abre o pacote diário, guarda as figurinhas e registra a abertura', async () => {
    const r = await servico.abrirPacoteDiario(usuarioId, new Date('2026-11-17T12:00:00Z'));
    expect(r.figurinhas).toHaveLength(5);

    const itens = await prisma.itemAlbum.findMany({ where: { usuarioId } });
    expect(itens.reduce((s, i) => s + i.quantidade, 0)).toBe(5);
    expect(await prisma.aberturaPacote.count({ where: { usuarioId } })).toBe(1);
    const u = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(u.pacotesSemLendaria).toBe(1);
  });

  it('permite só um pacote grátis por dia (meia-noite de Brasília)', async () => {
    await servico.abrirPacoteDiario(usuarioId, new Date('2026-11-17T12:00:00Z'));
    // 23h50 em Brasília: ainda é o mesmo dia.
    await expect(servico.abrirPacoteDiario(usuarioId, new Date('2026-11-18T02:50:00Z'))).rejects.toMatchObject({
      response: { codigo: 'PACOTE_DIARIO_JA_ABERTO' },
    });
    // 00h10 em Brasília: dia novo.
    await expect(servico.abrirPacoteDiario(usuarioId, new Date('2026-11-18T03:10:00Z'))).resolves.toBeDefined();
  });

  it('não abre dois pacotes diários com pedidos simultâneos', async () => {
    const agora = new Date('2026-11-20T12:00:00Z');
    const resultados = await Promise.allSettled([
      servico.abrirPacoteDiario(usuarioId, agora),
      servico.abrirPacoteDiario(usuarioId, agora),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.aberturaPacote.count({ where: { usuarioId } })).toBe(1);
  });

  it('aplica a garantia de Épica no 10º pacote sem Épica', async () => {
    servico.rng = () => 0; // o sorteio sozinho só daria Comuns
    await prisma.usuario.update({ where: { id: usuarioId }, data: { pacotesSemEpica: 9 } });
    const r = await servico.abrirPacoteDiario(usuarioId, new Date('2026-11-21T12:00:00Z'));
    expect(r.figurinhas.some((f) => f.raridade === 'EPICA' && f.garantida)).toBe(true);
    const u = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(u.pacotesSemEpica).toBe(0);
  });

  it('troca 4 repetidas por uma figurinha que falta no balcão', async () => {
    await prisma.itemAlbum.create({ data: { usuarioId, figurinhaCodigo: 'TUB-05', quantidade: 5 } });
    const r = await servico.trocarNoBalcao(usuarioId, 'UNI-05');
    expect(r).toEqual({ recebida: 'UNI-05', consumidas: { 'TUB-05': 4 } });

    const itens = await prisma.itemAlbum.findMany({ where: { usuarioId }, orderBy: { figurinhaCodigo: 'asc' } });
    expect(itens.map((i) => [i.figurinhaCodigo, i.quantidade])).toEqual([
      ['TUB-05', 1],
      ['UNI-05', 1],
    ]);
    await expect(servico.trocarNoBalcao(usuarioId, 'UNI-07')).rejects.toMatchObject({
      response: { codigo: 'REPETIDAS_INSUFICIENTES' },
    });
  });
});
