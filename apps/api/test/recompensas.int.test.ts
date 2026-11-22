/**
 * Recompensas por página e álbum completos, com PostgreSQL de verdade.
 * Precisa de DATABASE_URL (banco migrado e com seed); sem ela, é pulado.
 */
import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { rngComSemente } from '@craques-da-varzea/regras';
import { PacotesService } from '../src/pacotes/pacotes.service';
import { PrismaService } from '../src/prisma/prisma.service';

const temBanco = !!process.env.DATABASE_URL;

describe.skipIf(!temBanco)('Recompensas', () => {
  const prisma = new PrismaService();
  const servico = new PacotesService(prisma);
  let usuarioId: string;
  let catalogo: { codigo: string; secao: string; raridade: string }[];

  /** Dá ao jogador uma cópia de cada figurinha da lista. */
  const colar = (codigos: string[], quantidade = 1) =>
    prisma.itemAlbum.createMany({ data: codigos.map((c) => ({ usuarioId, figurinhaCodigo: c, quantidade })) });

  beforeAll(async () => {
    await prisma.$connect();
    await servico.onModuleInit();
    catalogo = await prisma.figurinha.findMany({ where: { temporada: 1 }, select: { codigo: true, secao: true, raridade: true }, orderBy: { numero: 'asc' } });
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { apelido: { startsWith: 'rec-' } } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    servico.rng = rngComSemente(7);
    const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const u = await prisma.usuario.create({ data: { apelido: `rec-${sufixo}`, email: `rec-${sufixo}@exemplo.com`, senhaHash: 'x' } });
    usuarioId = u.id;
  });

  it('dá 1 pacote de recompensa ao completar uma página, só uma vez', async () => {
    const uni = catalogo.filter((f) => f.secao === 'Unidos da Várzea');
    const falta = uni.find((f) => f.raridade === 'COMUM')!;
    await colar(uni.filter((f) => f.codigo !== falta.codigo).map((f) => f.codigo));
    // 4 repetidas Comuns de outro clube para pagar o balcão
    await colar(['TUB-01'], 5);

    const r = await servico.trocarNoBalcao(usuarioId, falta.codigo);
    expect(r.recompensas).toEqual([{ tipo: 'PAGINA', chave: 'Unidos da Várzea', temporada: 1, pacotes: 1 }]);
    let u = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(u.pacotesBonus).toBe(1);

    // Abrir o pacote bônus não repete a recompensa da página já completa.
    const pacote = await servico.abrirPacoteBonus(usuarioId);
    expect(pacote.figurinhas).toHaveLength(5);
    expect(pacote.recompensas.filter((x) => x.chave === 'Unidos da Várzea')).toHaveLength(0);
    u = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(u.pacotesBonus).toBe(0);
    expect(await prisma.aberturaPacote.count({ where: { usuarioId, origem: 'RECOMPENSA' } })).toBe(1);
  });

  it('recusa abrir pacote bônus sem ter um', async () => {
    await expect(servico.abrirPacoteBonus(usuarioId)).rejects.toMatchObject({ response: { codigo: 'SEM_PACOTE_BONUS' } });
  });

  it('entrega o troféu ao completar o álbum, junto com a última página', async () => {
    const ultima = catalogo.find((f) => f.codigo === 'LEN-08')!;
    await colar(catalogo.filter((f) => f.codigo !== ultima.codigo).map((f) => f.codigo));
    // Repetidas Lendárias para pagar o balcão: 4 cópias extras de LEN-01.
    await prisma.itemAlbum.update({
      where: { usuarioId_figurinhaCodigo: { usuarioId, figurinhaCodigo: 'LEN-01' } },
      data: { quantidade: 5 },
    });

    const r = await servico.trocarNoBalcao(usuarioId, ultima.codigo);
    // As outras 9 páginas já estavam completas antes desta troca e também são entregues agora.
    expect(r.recompensas.filter((x) => x.tipo === 'PAGINA')).toHaveLength(10);
    expect(r.recompensas).toContainEqual({ tipo: 'ALBUM', chave: 'T1', temporada: 1, pacotes: 0 });

    const perfil = await servico.perfil(usuarioId);
    expect(perfil.album).toEqual({ coladas: 136, total: 136 });
    expect(perfil.pacotesBonus).toBe(10);
    expect(perfil.recompensas.map((x) => x.tipo).filter((t) => t === 'ALBUM')).toHaveLength(1);

    // Nada é entregue de novo.
    await prisma.itemAlbum.update({
      where: { usuarioId_figurinhaCodigo: { usuarioId, figurinhaCodigo: 'TUB-04' } },
      data: { quantidade: 1 },
    });
    expect((await servico.abrirPacoteBonus(usuarioId)).recompensas).toEqual([]);
  });
});
