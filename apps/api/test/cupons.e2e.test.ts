/**
 * Cupons de pacotes bônus, de ponta a ponta, com PostgreSQL de verdade.
 * Precisa de DATABASE_URL (banco migrado e com seed); sem ela, é pulado.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar';
import { gerarCodigo } from '../src/cupons/cupons.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('código gerado', () => {
  it('tem 8 caracteres sem símbolos ambíguos', () => {
    for (let i = 0; i < 200; i++) expect(gerarCodigo()).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
  });
});

describe.skipIf(!process.env.DATABASE_URL)('Cupons', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let base: string;
  const sufixo = String(Date.now()).slice(-8);
  const contas: Record<string, { token: string; id: string; apelido: string }> = {};
  const criados: string[] = [];

  const chamar = async (metodo: string, rota: string, token: string, corpo?: unknown) => {
    const r = await fetch(base + rota, {
      method: metodo,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const texto = await r.text();
    return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
  };

  const cadastrar = async (nome: string) => {
    const apelido = `cup${nome}_${sufixo}`;
    const r = await chamar('POST', '/auth/cadastro', '', { apelido, email: `cup-${nome}-${sufixo}@exemplo.com`, senha: 'senha-forte-123' });
    contas[nome] = { token: r.corpo.token, id: r.corpo.usuario.id, apelido };
  };

  const bonus = async (nome: string) => (await chamar('GET', '/eu', contas[nome].token)).corpo.pacotesBonus as number;

  const criar = async (corpo: Record<string, unknown>) => {
    const r = await chamar('POST', '/admin/cupons', contas.admin.token, corpo);
    if (r.status === 201) criados.push(r.corpo.id);
    return r;
  };

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configurarApp(app);
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    for (const n of ['admin', 'ana', 'bia', 'caio']) await cadastrar(n);
    await prisma.usuario.update({ where: { id: contas.admin.id }, data: { papel: 'ADMIN' } });
  });

  afterAll(async () => {
    await prisma.cupom.deleteMany({ where: { id: { in: criados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: Object.values(contas).map((c) => c.id) } } });
    await app.close();
  });

  it('só administradores criam e listam cupons', async () => {
    expect((await chamar('POST', '/admin/cupons', contas.ana.token, { pacotes: 1 })).status).toBe(403);
    expect((await chamar('GET', '/admin/cupons', contas.ana.token)).status).toBe(403);
    expect((await chamar('GET', '/admin/cupons', '')).status).toBe(401);
  });

  it('valida a entrada e aponta destinatários que não existem', async () => {
    expect((await criar({ pacotes: 0 })).status).toBe(400);
    expect((await criar({ pacotes: 3, codigo: 'a b' })).status).toBe(400);
    expect((await criar({ pacotes: 3, validoAte: '2020-01-01' })).status).toBe(400);
    const r = await criar({ pacotes: 3, destinatarios: [contas.ana.apelido, 'ninguem_aqui'] });
    expect(r.status).toBe(422);
    expect(r.corpo.faltando).toEqual(['ninguem_aqui']);
  });

  it('cupom para contas escolhidas: aparece só para elas e dá os pacotes uma vez', async () => {
    const r = await criar({
      pacotes: 3,
      descricao: 'Presente de teste',
      // apelido em outra caixa e e-mail também valem
      destinatarios: [contas.ana.apelido.toUpperCase(), `cup-bia-${sufixo}@exemplo.com`],
    });
    expect(r.status).toBe(201);
    expect(r.corpo.destinatarios).toBe(2);
    const codigo = r.corpo.codigo as string;
    expect(codigo).toMatch(/^[A-Z0-9]{8}$/);

    const daAna = (await chamar('GET', '/cupons', contas.ana.token)).corpo;
    expect(daAna).toEqual([expect.objectContaining({ codigo, pacotes: 3, descricao: 'Presente de teste' })]);
    expect((await chamar('GET', '/cupons', contas.caio.token)).corpo).toEqual([]);

    // Quem não é destinatário recebe a mesma resposta de código inexistente.
    const caio = await chamar('POST', '/cupons/resgatar', contas.caio.token, { codigo });
    expect(caio.status).toBe(404);
    expect(caio.corpo.codigo).toBe('CUPOM_INVALIDO');

    const antes = await bonus('ana');
    const ok = await chamar('POST', '/cupons/resgatar', contas.ana.token, { codigo: codigo.toLowerCase() });
    expect(ok.status).toBe(200);
    expect(ok.corpo).toMatchObject({ pacotes: 3, pacotesBonus: antes + 3 });
    expect(await bonus('ana')).toBe(antes + 3);

    const repetido = await chamar('POST', '/cupons/resgatar', contas.ana.token, { codigo });
    expect(repetido.status).toBe(409);
    expect(await bonus('ana')).toBe(antes + 3);
    expect((await chamar('GET', '/cupons', contas.ana.token)).corpo).toEqual([]);

    const lista = (await chamar('GET', '/admin/cupons', contas.admin.token)).corpo;
    const meu = lista.find((c: { codigo: string }) => c.codigo === codigo);
    expect(meu).toMatchObject({ status: 'ATIVO', usos: 1, criadoPorApelido: contas.admin.apelido });
    expect(meu.destinatarios).toEqual(
      expect.arrayContaining([
        { apelido: contas.ana.apelido, resgatou: true },
        { apelido: contas.bia.apelido, resgatou: false },
      ]),
    );
  });

  it('cupom aberto respeita o limite de usos, mesmo com resgates simultâneos', async () => {
    const codigo = `ABERTO-${sufixo}`;
    expect((await criar({ pacotes: 2, codigo, maxUsos: 1 })).status).toBe(201);
    expect((await criar({ pacotes: 2, codigo })).status).toBe(409);

    const respostas = await Promise.all(
      ['ana', 'bia', 'caio'].map((n) => chamar('POST', '/cupons/resgatar', contas[n].token, { codigo })),
    );
    expect(respostas.filter((r) => r.status === 200)).toHaveLength(1);
    expect(respostas.filter((r) => r.corpo.codigo === 'CUPOM_ESGOTADO')).toHaveLength(2);
    // Cupom aberto não aparece na lista de "meus cupons".
    expect((await chamar('GET', '/cupons', contas.caio.token)).corpo).toEqual([]);
  });

  it('cupom desativado ou vencido não pode ser resgatado', async () => {
    const r = await criar({ pacotes: 1, destinatarios: [contas.caio.apelido] });
    const { id, codigo } = r.corpo;
    expect((await chamar('PATCH', `/admin/cupons/${id}`, contas.admin.token, { ativo: false })).status).toBe(200);
    expect((await chamar('GET', '/cupons', contas.caio.token)).corpo).toEqual([]);
    expect((await chamar('POST', '/cupons/resgatar', contas.caio.token, { codigo })).status).toBe(404);
    await chamar('PATCH', `/admin/cupons/${id}`, contas.admin.token, { ativo: true });

    await prisma.cupom.update({ where: { id }, data: { validoAte: new Date(Date.now() - 1000) } });
    const vencido = await chamar('POST', '/cupons/resgatar', contas.caio.token, { codigo });
    expect(vencido.status).toBe(422);
    expect(vencido.corpo.codigo).toBe('CUPOM_EXPIRADO');
    const lista = (await chamar('GET', '/admin/cupons', contas.admin.token)).corpo;
    expect(lista.find((c: { id: string }) => c.id === id).status).toBe('EXPIRADO');
  });

  it('os pacotes do cupom abrem como pacotes bônus', async () => {
    const r = await criar({ pacotes: 1, destinatarios: [contas.caio.apelido] });
    // Caio pode ter ganho a disputa do cupom aberto: compara com o saldo de antes.
    const antes = await bonus('caio');
    await chamar('POST', '/cupons/resgatar', contas.caio.token, { codigo: r.corpo.codigo });
    expect(await bonus('caio')).toBe(antes + 1);
    const aberto = await chamar('POST', '/pacotes/bonus', contas.caio.token);
    expect(aberto.status).toBe(200);
    expect(aberto.corpo.figurinhas).toHaveLength(5);
    expect(await bonus('caio')).toBe(antes);
  });
});
