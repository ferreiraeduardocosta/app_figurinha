/**
 * Loja, de ponta a ponta, com PostgreSQL de verdade.
 * Precisa de DATABASE_URL (banco migrado e com seed); sem ela, é pulado.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const temBanco = !!process.env.DATABASE_URL;
const SEGREDO = 'segredo-do-webhook-de-teste';

/** Data de nascimento de alguém com `anos` completos hoje (AAAA-MM-DD). */
const nascidoHa = (anos: number) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - anos);
  d.setUTCDate(d.getUTCDate() - 2);
  return d.toISOString().slice(0, 10);
};

describe.skipIf(!temBanco)('Loja', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let base: string;
  const sufixo = String(Date.now()).slice(-8);
  const contas: Record<'adulto' | 'jovem' | 'crianca', { id: string; token: string }> = {} as never;
  const ambienteAntes = { LOJA_TESTE: process.env.LOJA_TESTE, REVENUECAT_WEBHOOK_TOKEN: process.env.REVENUECAT_WEBHOOK_TOKEN };

  const chamar = async (metodo: string, rota: string, token: string | null, corpo?: unknown, extra: Record<string, string> = {}) => {
    const r = await fetch(base + rota, {
      method: metodo,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const texto = await r.text();
    return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
  };
  const de = (quem: keyof typeof contas) => ({
    get: (rota: string) => chamar('GET', rota, contas[quem].token),
    post: (rota: string, corpo?: unknown) => chamar('POST', rota, contas[quem].token, corpo),
  });
  const saldo = async (quem: keyof typeof contas) =>
    prisma.usuario.findUniqueOrThrow({ where: { id: contas[quem].id }, select: { pacotesComprados: true, moedas: true } });
  const webhook = (evento: Record<string, unknown>, token = SEGREDO) =>
    chamar('POST', '/loja/webhook/revenuecat', null, { api_version: '1.0', event: evento }, token ? { authorization: token } : {});

  beforeAll(async () => {
    process.env.LOJA_TESTE = '1';
    process.env.REVENUECAT_WEBHOOK_TOKEN = SEGREDO;
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    for (const nome of ['adulto', 'jovem', 'crianca'] as const) {
      const r = await chamar('POST', '/auth/cadastro', null, {
        apelido: `${nome}_${sufixo}`,
        email: `loja-e2e-${nome}-${sufixo}@exemplo.com`,
        senha: 'senha-forte-123',
      });
      contas[nome] = { id: r.corpo.usuario.id, token: r.corpo.token };
    }
  });

  afterAll(async () => {
    const ids = Object.values(contas).map((c) => c.id);
    await prisma.compra.deleteMany({ where: { usuarioId: { in: ids } } });
    await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
    await app.close();
    for (const [k, v] of Object.entries(ambienteAntes)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('mostra as ofertas e pede a data de nascimento antes da primeira compra', async () => {
    const r = await de('adulto').get('/loja');
    expect(r.corpo.ofertas.map((o: { id: string }) => o.id)).toEqual(['pacote_1', 'pacote_6', 'pacote_15', 'pacote_40']);
    expect(r.corpo.compras).toMatchObject({ podeComprar: false, motivo: 'INFORME_NASCIMENTO' });
    expect(r.corpo.modoTeste).toBe(true);
    expect((await de('adulto').post('/loja/compra-teste', { produtoId: 'pacote_1' })).corpo.codigo).toBe('INFORME_NASCIMENTO');
  });

  it('aceita a data de nascimento uma única vez', async () => {
    expect((await de('adulto').post('/loja/nascimento', { dataNascimento: '10/05/1990' })).status).toBe(400);
    expect((await de('adulto').post('/loja/nascimento', { dataNascimento: '1990-02-30' })).status).toBe(400);
    const ok = await de('adulto').post('/loja/nascimento', { dataNascimento: '1990-05-10' });
    expect(ok.corpo.compras).toMatchObject({ podeComprar: true, limiteMesCentavos: null });
    expect((await de('adulto').post('/loja/nascimento', { dataNascimento: '2015-01-01' })).corpo.codigo).toBe('NASCIMENTO_JA_INFORMADO');
  });

  it('compra de teste credita pacotes e moedas; abrir pacote comprado e com moedas', async () => {
    const r = await de('adulto').post('/loja/compra-teste', { produtoId: 'pacote_15' });
    expect(r.status).toBe(200);
    expect(r.corpo.compra).toMatchObject({ loja: 'TESTE', pacotes: 15, moedas: 100, valorCentavos: 1990 });
    expect(await saldo('adulto')).toEqual({ pacotesComprados: 15, moedas: 100 });

    const p = await de('adulto').post('/pacotes/comprado');
    expect(p.corpo.figurinhas).toHaveLength(5);
    expect((await saldo('adulto')).pacotesComprados).toBe(14);

    const m = await de('adulto').post('/pacotes/moedas');
    expect(m.corpo.figurinhas).toHaveLength(5);
    expect((await saldo('adulto')).moedas).toBe(0);
    expect((await de('adulto').post('/pacotes/moedas')).corpo.codigo).toBe('MOEDAS_INSUFICIENTES');
    expect(await prisma.aberturaPacote.count({ where: { usuarioId: contas.adulto.id, origem: { in: ['COMPRA', 'MOEDAS'] } } })).toBe(2);
    expect((await de('adulto').get('/eu')).corpo.pacotesComprados).toBe(14);
  });

  it('menor de 18: limite de R$ 50 por mês; menor de 13: não compra', async () => {
    await de('jovem').post('/loja/nascimento', { dataNascimento: nascidoHa(15) });
    expect((await de('jovem').post('/loja/compra-teste', { produtoId: 'pacote_40' })).status).toBe(200); // R$ 44,90
    expect((await de('jovem').post('/loja/compra-teste', { produtoId: 'pacote_6' })).corpo.codigo).toBe('LIMITE_MENSAL'); // +9,90
    expect((await de('jovem').post('/loja/compra-teste', { produtoId: 'pacote_1' })).status).toBe(200); // +1,90 = 46,80
    const loja = await de('jovem').get('/loja');
    expect(loja.corpo.compras).toMatchObject({ idade: 15, gastoMesCentavos: 4680, limiteMesCentavos: 5000, podeComprar: true });

    await de('crianca').post('/loja/nascimento', { dataNascimento: nascidoHa(10) });
    expect((await de('crianca').get('/loja')).corpo.compras).toMatchObject({ podeComprar: false, motivo: 'IDADE_MINIMA' });
    expect((await de('crianca').post('/loja/compra-teste', { produtoId: 'pacote_1' })).status).toBe(403);
  });

  it('webhook do RevenueCat: exige o segredo, credita uma vez só e estorna', async () => {
    const compra = {
      type: 'NON_RENEWING_PURCHASE',
      app_user_id: contas.adulto.id,
      product_id: 'pacote_6',
      transaction_id: `GPA.teste-${sufixo}`,
      store: 'PLAY_STORE',
      environment: 'SANDBOX',
      price_in_purchased_currency: 9.9,
      currency: 'BRL',
    };
    expect((await webhook(compra, '')).status).toBe(401);
    expect((await webhook(compra, 'segredo-errado')).status).toBe(401);

    const antes = (await saldo('adulto')).pacotesComprados;
    // Mesmo aviso chegando duas vezes ao mesmo tempo, e depois de novo.
    const [r1, r2] = await Promise.all([webhook(compra), webhook(compra)]);
    expect([r1.corpo.acao, r2.corpo.acao].sort()).toEqual(['creditada', 'ja_creditada']);
    expect((await webhook(compra)).corpo.acao).toBe('ja_creditada');
    expect((await saldo('adulto')).pacotesComprados).toBe(antes + 6);
    expect(await prisma.compra.findUniqueOrThrow({ where: { transacaoId: compra.transaction_id } })).toMatchObject({
      loja: 'PLAY_STORE',
      ambiente: 'SANDBOX',
      valorCentavos: 990,
    });

    expect((await webhook({ ...compra, transaction_id: 'x1', product_id: 'nao_existe' })).corpo.acao).toBe('ignorado');
    expect((await webhook({ ...compra, transaction_id: 'x2', app_user_id: 'alguem' })).corpo.acao).toBe('ignorado');
    expect((await webhook({ type: 'TEST' })).corpo.acao).toBe('teste');

    const estorno = await webhook({ type: 'CANCELLATION', transaction_id: compra.transaction_id, app_user_id: contas.adulto.id });
    expect(estorno.corpo.acao).toBe('estornada');
    expect((await saldo('adulto')).pacotesComprados).toBe(antes);
    expect((await webhook({ type: 'CANCELLATION', transaction_id: compra.transaction_id })).corpo.acao).toBe('ignorado');
  });

  it('sem LOJA_TESTE a compra de teste não existe', async () => {
    delete process.env.LOJA_TESTE;
    expect((await de('adulto').post('/loja/compra-teste', { produtoId: 'pacote_1' })).status).toBe(404);
    expect((await de('adulto').get('/loja')).corpo.modoTeste).toBe(false);
    process.env.LOJA_TESTE = '1';
  });
});
