/**
 * Várias temporadas, de ponta a ponta: uma Temporada 2 de teste (5 figurinhas) criada
 * pelo painel, liberada só para quem completou o álbum da T1, com pacote grátis próprio,
 * páginas e álbum próprios, trocas sem misturar temporadas e liga própria.
 * Precisa de DATABASE_URL (banco migrado e com seed); sem ela, é pulado.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { LigaService } from '../src/liga/liga.service';
import { PacotesService } from '../src/pacotes/pacotes.service';
import { PrismaService } from '../src/prisma/prisma.service';

const temBanco = !!process.env.DATABASE_URL;
// Temporada de teste (9), com clubes próprios, para não mexer na Temporada 2 de verdade.
const T2 = 9;
const CODIGOS_T2 = ['T9-TQA-01', 'T9-TQA-02', 'T9-TQA-03', 'T9-TQA-04', 'T9-TQA-05'];
const SIGLAS_T9 = ['TQA', 'TQB', 'TQC', 'TQD', 'TQE', 'TQF', 'TQG', 'TQH'];
const RARIDADES = ['COMUM', 'COMUM', 'RARA', 'EPICA', 'LENDARIA'] as const;

describe.skipIf(!temBanco)('Temporadas', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let base: string;
  const sufixo = String(Date.now()).slice(-8);
  const c: Record<'admin' | 'ana' | 'bia', { id: string; token: string }> = {} as never;

  const chamar = async (metodo: string, rota: string, token: string, corpo?: unknown) => {
    const r = await fetch(base + rota, {
      method: metodo,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const texto = await r.text();
    return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
  };
  const limparT2 = async () => {
    await prisma.itemAlbum.deleteMany({ where: { figurinhaCodigo: { in: CODIGOS_T2 } } });
    await prisma.figurinha.deleteMany({ where: { temporada: T2 } });
    await prisma.partida.deleteMany({ where: { temporada: T2 } });
    await prisma.configuracaoLiga.deleteMany({ where: { temporada: T2 } });
    await prisma.pacoteDiario.deleteMany({ where: { temporada: T2 } });
    await prisma.temporada.deleteMany({ where: { numero: T2 } });
    await prisma.clube.deleteMany({ where: { sigla: { in: SIGLAS_T9 } } });
  };

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    await limparT2();
    await prisma.clube.createMany({
      data: SIGLAS_T9.map((sigla) => ({
        sigla, nome: `Teste ${sigla}`, cidade: 'Teste', corPrimaria: '#000000', corSecundaria: '#FFFFFF',
        estadio: 'Teste', capacidade: 1, mascote: 'Teste', lema: 'Teste', identidade: 'Teste', temporada: T2,
      })),
    });
    for (const nome of ['admin', 'ana', 'bia'] as const) {
      const r = await chamar('POST', '/auth/cadastro', '', {
        apelido: `s${nome}_${sufixo}`,
        email: `temporadas-e2e-${nome}-${sufixo}@exemplo.com`,
        senha: 'senha-forte-123',
      });
      c[nome] = { id: r.corpo.usuario.id, token: r.corpo.token };
    }
    await prisma.usuario.update({ where: { id: c.admin.id }, data: { papel: 'ADMIN' } });
    await prisma.amizade.create({ data: { solicitanteId: c.ana.id, destinatarioId: c.bia.id, status: 'ACEITA', aceitaEm: new Date() } });
  });

  afterAll(async () => {
    await limparT2();
    await prisma.usuario.deleteMany({ where: { email: { startsWith: 'temporadas-e2e-' } } });
    await app.get(PacotesService).recarregarCatalogo();
    await app.close();
  });

  it('painel cria a temporada escondida e só publica quando ela está completa', async () => {
    const criar = await chamar('POST', '/admin/temporadas', c.admin.token, { numero: T2, nome: 'Temporada Teste', requisito: 1 });
    expect(criar.status).toBe(201);
    expect(criar.corpo.find((t: { numero: number }) => t.numero === T2)).toMatchObject({ publicada: false, requisito: 1, figurinhas: 0 });
    expect((await chamar('POST', '/admin/temporadas', c.ana.token, { numero: 3, nome: 'X' })).status).toBe(403);
    expect((await chamar('PATCH', `/admin/temporadas/${T2}`, c.admin.token, { publicada: true })).corpo.codigo).toBe('TEMPORADA_INCOMPLETA');

    // Figurinha nova pelo painel: código com o prefixo da temporada.
    const nova = (codigo: string, numero: number, raridade: string) => ({
      codigo, numero, temporada: T2, secao: 'Tubarões do Cais', clubeSigla: 'TQA', tipo: 'JOGADOR', raridade,
      nome: `Teste ${numero}`, historia: 'Teste.', descricaoVisual: 'Teste.',
    });
    expect((await chamar('POST', '/admin/figurinhas', c.admin.token, nova('TUB-99', 1, 'COMUM'))).corpo.campo).toBe('codigo');
    for (const [i, codigo] of CODIGOS_T2.entries()) {
      const r = await chamar('POST', '/admin/figurinhas', c.admin.token, nova(codigo, i + 1, RARIDADES[i]));
      expect(r.status).toBe(201);
    }
    // Clube de outra temporada é recusado.
    expect((await chamar('POST', '/admin/figurinhas', c.admin.token, { ...nova('T9-TQA-99', 99, 'COMUM'), clubeSigla: 'TUB' })).corpo.codigo).toBe('CLUBE_DE_OUTRA_TEMPORADA');
    // O número pode repetir o da T1 (é único só dentro da temporada).
    expect((await prisma.figurinha.findFirst({ where: { temporada: 1, numero: 1 } }))).not.toBeNull();

    expect((await fetch(base + '/temporadas').then((x) => x.json())).map((t: { numero: number }) => t.numero)).not.toContain(T2);
    const pub = await chamar('PATCH', `/admin/temporadas/${T2}`, c.admin.token, { publicada: true });
    expect(pub.status).toBe(200);
    expect(pub.corpo.find((t: { numero: number }) => t.numero === T2)).toMatchObject({ publicada: true, pronta: true, figurinhas: 5 });
    expect((await fetch(base + '/temporadas').then((x) => x.json())).map((t: { numero: number }) => t.numero)).toContain(T2);
    const codigos = (await fetch(base + '/figurinhas').then((x) => x.json())).map((f: { codigo: string }) => f.codigo);
    expect(codigos).toEqual(expect.arrayContaining(CODIGOS_T2));
    expect((await chamar('PATCH', '/admin/temporadas/1', c.admin.token, { publicada: false })).status).toBe(400);
  });

  it('a T2 fica bloqueada até completar o álbum da T1', async () => {
    const eu = (await chamar('GET', '/eu', c.ana.token)).corpo;
    const lib = Object.fromEntries(eu.temporadas.map((t: { numero: number; liberada: boolean }) => [t.numero, t.liberada]));
    expect(lib).toMatchObject({ 1: true, [T2]: false });
    // Campos antigos continuam sendo da T1 (APK já instalado).
    expect(eu.album.total).toBe(136);
    const r = await chamar('POST', '/pacotes/diario', c.ana.token, { temporada: T2 });
    expect(r.status).toBe(403);
    expect(r.corpo.codigo).toBe('TEMPORADA_BLOQUEADA');
    expect(r.corpo.mensagem).toContain('Complete o álbum da Várzea');
  });

  it('com a T1 completa: pacote grátis próprio da T2, independente do da T1', async () => {
    await prisma.recompensa.create({ data: { usuarioId: c.ana.id, tipo: 'ALBUM', chave: 'T1' } });
    const daT2 = (eu: { temporadas: { numero: number; album: { coladas: number } }[] }) => eu.temporadas.find((t) => t.numero === T2)!;
    expect(daT2((await chamar('GET', '/eu', c.ana.token)).corpo)).toMatchObject({ liberada: true, pacoteDiario: { disponivel: true } });

    const t2 = await chamar('POST', '/pacotes/diario', c.ana.token, { temporada: T2 });
    expect(t2.status).toBe(200);
    expect(t2.corpo.figurinhas.every((f: { codigo: string }) => CODIGOS_T2.includes(f.codigo))).toBe(true);
    expect((await chamar('POST', '/pacotes/diario', c.ana.token, { temporada: T2 })).status).toBe(409);

    // O da T1 continua disponível no mesmo dia (sem corpo = T1, como no app antigo).
    const t1 = await chamar('POST', '/pacotes/diario', c.ana.token);
    expect(t1.status).toBe(200);
    expect(t1.corpo.figurinhas.every((f: { codigo: string }) => !/^T\d+-/.test(f.codigo))).toBe(true);

    const eu = (await chamar('GET', '/eu', c.ana.token)).corpo;
    expect(eu.temporadas[0].pacoteDiario.disponivel).toBe(false);
    expect(daT2(eu)).toMatchObject({ pacoteDiario: { disponivel: false }, album: { total: 5 } });
    expect(daT2(eu).album.coladas).toBeGreaterThan(0);
  });

  it('página e álbum da T2 dão recompensas próprias (sem confundir com a página da T1)', async () => {
    await prisma.itemAlbum.deleteMany({ where: { usuarioId: c.ana.id } });
    await prisma.recompensa.deleteMany({ where: { usuarioId: c.ana.id, tipo: 'PAGINA' } });
    await prisma.itemAlbum.createMany({
      data: [
        { usuarioId: c.ana.id, figurinhaCodigo: 'T9-TQA-01', quantidade: 5 },
        { usuarioId: c.ana.id, figurinhaCodigo: 'T9-TQA-03', quantidade: 1 },
        { usuarioId: c.ana.id, figurinhaCodigo: 'T9-TQA-04', quantidade: 1 },
        { usuarioId: c.ana.id, figurinhaCodigo: 'T9-TQA-05', quantidade: 1 },
      ],
    });
    const album = (await chamar('GET', '/album', c.ana.token)).corpo;
    expect(album.repetidasPorTemporada[String(T2)]).toMatchObject({ COMUM: 4 });
    expect(album.repetidas).toMatchObject({ COMUM: 0 });

    // Balcão: 4 repetidas comuns da T2 pela comum que falta da T2.
    const r = await chamar('POST', '/balcao', c.ana.token, { codigo: 'T9-TQA-02' });
    expect(r.status).toBe(200);
    expect(r.corpo.recompensas).toEqual(
      expect.arrayContaining([
        { tipo: 'PAGINA', chave: 'T9:Tubarões do Cais', temporada: T2, pacotes: 1 },
        { tipo: 'ALBUM', chave: 'T9', temporada: T2, pacotes: 0 },
      ]),
    );
    expect(await prisma.recompensa.count({ where: { usuarioId: c.ana.id, tipo: 'PAGINA', chave: 'Tubarões do Cais' } })).toBe(0);
  });

  it('trocas e bafo não misturam temporadas, e só com quem liberou a temporada', async () => {
    await prisma.itemAlbum.deleteMany({ where: { usuarioId: { in: [c.ana.id, c.bia.id] } } });
    await prisma.itemAlbum.createMany({
      data: [
        { usuarioId: c.ana.id, figurinhaCodigo: 'T9-TQA-01', quantidade: 3 },
        { usuarioId: c.ana.id, figurinhaCodigo: 'UNI-05', quantidade: 3 },
        { usuarioId: c.bia.id, figurinhaCodigo: 'SER-04', quantidade: 3 },
        { usuarioId: c.bia.id, figurinhaCodigo: 'T9-TQA-02', quantidade: 3 },
      ],
    });
    const propor = (oferta: string, pedido: string) =>
      chamar('POST', '/trocas', c.ana.token, {
        paraId: c.bia.id,
        oferta: [{ codigo: oferta, quantidade: 1 }],
        pedido: [{ codigo: pedido, quantidade: 1 }],
      });
    expect((await propor('T9-TQA-01', 'SER-04')).corpo.codigo).toBe('TROCA_INVALIDA');
    // Bia não completou a T1: não pode receber nem dar figurinhas da T2.
    expect((await propor('T9-TQA-01', 'T9-TQA-02')).corpo.codigo).toBe('TEMPORADA_BLOQUEADA');
    expect((await propor('UNI-05', 'SER-04')).status).toBe(201);

    expect((await chamar('POST', '/bafo/computador', c.ana.token, { figurinhas: ['T9-TQA-01', 'UNI-05'] })).corpo.codigo).toBe('BAFO_INVALIDO');
    const b = await chamar('POST', '/bafo/computador', c.ana.token, { figurinhas: ['T9-TQA-01'] });
    expect(b.status).toBe(201);
    await chamar('POST', `/bafo/${b.corpo.id}/bater`, c.ana.token, { precisao: 1 });
    const fim = (await chamar('GET', `/bafo/${b.corpo.id}`, c.ana.token)).corpo;
    expect(fim.monte.filter((m: { codigo: string | null }) => m.codigo).every((m: { codigo: string }) => m.codigo.startsWith('T9-'))).toBe(true);
  });

  it('cada temporada tem a sua liga; a da T2 só existe depois de marcada', async () => {
    const antes = await fetch(base + `/liga?temporada=${T2}`).then((x) => x.json());
    expect(antes).toMatchObject({ temporada: T2, marcada: false, totalRodadas: 0 });
    const t1Antes = await fetch(base + '/liga').then((x) => x.json());

    const r = await chamar('POST', '/admin/testes/liga', c.admin.token, { primeiraRodada: '2099-03-01T18:00', intervalo: 7, unidade: 'dias', temporada: T2 });
    expect(r.status).toBe(200);
    const depois = await fetch(base + `/liga?temporada=${T2}`).then((x) => x.json());
    expect(depois).toMatchObject({ temporada: T2, marcada: true, totalRodadas: 14, ultimaRodada: 0 });
    // A liga da T1 não muda.
    expect(await fetch(base + '/liga').then((x) => x.json())).toMatchObject({ temporada: 1, ultimaRodada: t1Antes.ultimaRodada });
    const painel = (await chamar('GET', '/admin/testes', c.admin.token)).corpo;
    const ligas = Object.fromEntries(painel.ligas.map((l: { temporada: number; marcada: boolean }) => [l.temporada, l.marcada]));
    expect(ligas).toMatchObject({ 1: true, [T2]: true });
    await app.get(LigaService).agenda(T2);
  });
});
